#!/usr/bin/env bun
import { Command } from 'commander';
import { loadConfig, getDefaultConfig } from '../config';
import { createProviders, parseModelString } from '../providers';
import { loadAllSkills, runSkill } from '../skills';
import { createAgentContext, runAgent } from '../agents';
import { SubagentPool } from '../subagents';
import { SessionTracker, simpleCompact, formatCost } from '../context';
import { createInterface } from 'readline';
import { join } from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { stringify } from 'yaml';

const VERSION = '0.1.0';

const program = new Command();

program
  .name('agentflow')
  .description('Agentic workflow framework for free/local LLMs')
  .version(VERSION)
  .option('--max-budget-usd <amount>', 'Maximum budget in USD for this session', parseFloat)
  .action(async (options) => {
    // Default action: start interactive TUI
    const { startTUI } = await import('../tui/App');
    await startTUI({ maxBudget: options.maxBudgetUsd });
  });

// Init command
program
  .command('init')
  .description('Initialize agentflow in current directory')
  .action(async () => {
    const configDir = join(process.cwd(), '.agentflow');
    const skillsDir = join(configDir, 'skills');
    
    await mkdir(configDir, { recursive: true });
    await mkdir(skillsDir, { recursive: true });

    const defaultConfig = getDefaultConfig();
    defaultConfig.providers = {
      ollama: {
        baseUrl: 'http://localhost:11434',
        models: ['llama3.3:70b', 'codellama:34b'],
      },
      groq: {
        apiKey: '${GROQ_API_KEY}',
        models: ['llama-3.3-70b-versatile'],
      },
    };

    await writeFile(
      join(configDir, 'config.yaml'),
      stringify(defaultConfig)
    );

    // Create example skill
    const exampleSkill = `---
name: brainstorming
description: Mandatory design phase before coding
trigger: (design|brainstorm|plan|architect)
---
# Brainstorming Skill

You are entering brainstorming mode. Before writing any code:

1. **Explore the problem space**
   - What are we trying to solve?
   - What are the constraints?
   - What are the edge cases?

2. **Ask clarifying questions**
   - Ask 2-3 questions to understand requirements better
   - Wait for answers before proceeding

3. **Present design options**
   - Offer 2-3 different approaches
   - List pros and cons of each

4. **Get approval**
   - Only proceed to implementation after design approval

## Task
{{input}}

Start by exploring the problem and asking questions.
`;

    await writeFile(join(skillsDir, 'SKILL-brainstorming.md'), exampleSkill);

    console.log('✓ Created .agentflow/config.yaml');
    console.log('✓ Created .agentflow/skills/SKILL-brainstorming.md');
    console.log('\nEdit config.yaml to configure your providers.');
  });

// Run command
program
  .command('run')
  .description('Run agent with a prompt')
  .argument('<prompt>', 'Initial prompt for the agent')
  .option('-m, --model <model>', 'Model to use (provider/model format)')
  .option('-c, --config <path>', 'Path to config file')
  .option('--max-turns <n>', 'Maximum conversation turns', '5')
  .option('--max-budget-usd <amount>', 'Maximum budget in USD', parseFloat)
  .action(async (prompt, options) => {
    const config = await loadConfig(options.config);
    const modelString = options.model || config.defaults?.main || 'ollama/llama3.3:70b';
    
    const { provider: providerName, model } = parseModelString(modelString);
    const providerConfig = config.providers[providerName];
    
    if (!providerConfig) {
      console.error(`Provider "${providerName}" not configured. Run 'agentflow init' first.`);
      process.exit(1);
    }

    const providers = createProviders(config.providers);
    const provider = providers.get(providerName);
    
    if (!provider) {
      console.error(`Failed to create provider: ${providerName}`);
      process.exit(1);
    }

    const skills = await loadAllSkills();
    const context = createAgentContext(config, skills);

    console.log(`Using ${modelString}`);
    if (options.maxBudgetUsd) {
      console.log(`Budget: $${options.maxBudgetUsd.toFixed(2)}`);
    }
    console.log();

    await runAgent(prompt, context, {
      provider,
      model,
      maxTurns: parseInt(options.maxTurns),
    });
  });

// Chat command (REPL)
program
  .command('chat')
  .description('Start interactive chat session')
  .option('-m, --model <model>', 'Model to use')
  .option('-c, --config <path>', 'Path to config file')
  .option('--max-budget-usd <amount>', 'Maximum budget in USD', parseFloat)
  .action(async (options) => {
    const config = await loadConfig(options.config);
    const modelString = options.model || config.defaults?.main || 'ollama/llama3.3:70b';
    
    const { provider: providerName, model } = parseModelString(modelString);
    const providerConfig = config.providers[providerName];
    
    if (!providerConfig) {
      console.error(`Provider "${providerName}" not configured.`);
      process.exit(1);
    }

    const providers = createProviders(config.providers);
    const provider = providers.get(providerName);
    
    if (!provider) {
      console.error(`Failed to create provider: ${providerName}`);
      process.exit(1);
    }

    const skills = await loadAllSkills();

    // Initialize session tracker
    const sessionTracker = new SessionTracker({
      model,
      provider: providerName,
      maxBudget: options.maxBudgetUsd,
    });

    console.log(`AgentFlow Chat - ${modelString}`);
    if (options.maxBudgetUsd) {
      console.log(`Budget: $${options.maxBudgetUsd.toFixed(2)}`);
    }
    console.log('Type /quit to exit, /skills to list skills, /cost for costs, /context for usage\n');

    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Store conversation history
    let history: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    const prompt = () => {
      // Get stats for prompt
      sessionTracker.setMessages(history);
      const stats = sessionTracker.getStats();
      
      // Color based on context usage
      const pct = stats.tokens.contextPercentage;
      let color = '\x1b[32m'; // green
      if (pct >= 90) color = '\x1b[31m'; // red
      else if (pct >= 70) color = '\x1b[33m'; // yellow
      else if (pct >= 50) color = '\x1b[36m'; // cyan
      
      const miniStatus = `\x1b[2m[${color}${pct}%\x1b[2m]\x1b[0m`;
      
      rl.question(`${miniStatus} > `, async (input) => {
        const trimmed = input.trim();
        
        if (trimmed === '/quit' || trimmed === '/exit') {
          // Print session summary
          console.log('\n\x1b[36m\x1b[1mSession Summary\x1b[0m');
          console.log('\x1b[90m───────────────────────────────────\x1b[0m');
          console.log(`Tokens: ${stats.tokens.total.toLocaleString()}`);
          console.log(`Cost: ${stats.costs.isLocal ? 'FREE' : formatCost(stats.costs.current)}`);
          rl.close();
          return;
        }

        if (trimmed === '/skills') {
          console.log('\nLoaded skills:');
          for (const skill of skills) {
            console.log(`  - ${skill.name}: ${skill.description}`);
          }
          console.log();
          prompt();
          return;
        }

        if (trimmed === '/clear') {
          history = [];
          sessionTracker.reset();
          console.log('Context cleared.\n');
          prompt();
          return;
        }

        if (trimmed === '/context') {
          console.log(sessionTracker.visualizeContext());
          prompt();
          return;
        }

        if (trimmed === '/cost') {
          console.log(sessionTracker.visualizeCosts());
          prompt();
          return;
        }

        if (trimmed.startsWith('/compact')) {
          const focus = trimmed.replace('/compact', '').trim() || undefined;
          if (history.length < 4) {
            console.log('Not enough messages to compact.\n');
          } else {
            const result = simpleCompact(history, { focus, model });
            // Update history with compacted messages
            history = result.messages as typeof history;
            console.log('\n\x1b[32m✓ Compaction complete\x1b[0m');
            console.log(`  Original: ${result.originalTokens.toLocaleString()} tokens`);
            console.log(`  After: ${result.compactedTokens.toLocaleString()} tokens`);
            console.log(`  Saved: ${result.savedTokens.toLocaleString()} tokens (${result.savedPercentage}%)\n`);
          }
          prompt();
          return;
        }

        if (trimmed.startsWith('/budget')) {
          const arg = trimmed.replace('/budget', '').trim();
          if (arg) {
            const newBudget = parseFloat(arg);
            if (!isNaN(newBudget) && newBudget > 0) {
              sessionTracker.setBudget(newBudget);
              console.log(`Budget set to: $${newBudget.toFixed(2)}\n`);
            } else {
              console.log('Invalid budget amount.\n');
            }
          } else {
            const s = sessionTracker.getStats();
            if (s.costs.budgetRemaining !== undefined) {
              console.log(`Budget: $${(s.costs.current + s.costs.budgetRemaining).toFixed(2)}`);
              console.log(`Spent: ${formatCost(s.costs.current)}`);
              console.log(`Remaining: ${formatCost(s.costs.budgetRemaining)}\n`);
            } else {
              console.log('No budget set. Use /budget <amount> to set one.\n');
            }
          }
          prompt();
          return;
        }

        if (trimmed === '/status') {
          const s = sessionTracker.getStats();
          console.log('\n\x1b[36m\x1b[1mSession Status\x1b[0m');
          console.log('\x1b[90m───────────────────────────────────\x1b[0m');
          console.log(`Provider: ${providerName}`);
          console.log(`Model: ${model}`);
          console.log(`Messages: ${history.length}`);
          console.log(`Tokens: ${s.tokens.total.toLocaleString()} (${s.tokens.contextPercentage}% of context)`);
          console.log(`Cost: ${s.costs.isLocal ? 'FREE' : formatCost(s.costs.current)}`);
          if (s.costs.budgetRemaining !== undefined) {
            console.log(`Budget remaining: ${formatCost(s.costs.budgetRemaining)}`);
          }
          console.log();
          prompt();
          return;
        }

        if (trimmed === '/help') {
          console.log('\nCommands:');
          console.log('  /quit, /exit  - Exit the session');
          console.log('  /clear        - Clear context');
          console.log('  /skills       - List available skills');
          console.log('  /context      - Show context usage visualization');
          console.log('  /cost         - Show session costs');
          console.log('  /compact [f]  - Compact conversation (optional focus)');
          console.log('  /budget [n]   - Show or set budget');
          console.log('  /status       - Show session statistics');
          console.log('  /help         - Show this help\n');
          prompt();
          return;
        }

        if (!trimmed) {
          prompt();
          return;
        }

        // Check budget before processing
        if (sessionTracker.isBudgetExceeded()) {
          console.log('\n\x1b[31m\x1b[1m🛑 Budget exceeded!\x1b[0m Use /cost to see details.\n');
          prompt();
          return;
        }

        // Show budget warning if needed
        const warning = sessionTracker.getBudgetWarning();
        if (warning) {
          console.log(`\x1b[33m${warning}\x1b[0m`);
        }

        try {
          // Track input
          const userMessage = { role: 'user' as const, content: trimmed };
          history.push(userMessage);
          sessionTracker.trackInput(userMessage);

          // Stream response
          process.stdout.write('\n\x1b[36m\x1b[1mAgent > \x1b[0m');
          let fullResponse = '';
          
          for await (const chunk of provider.chat(history, { model })) {
            process.stdout.write(chunk);
            fullResponse += chunk;
            sessionTracker.trackStreamingChunk(chunk);
          }
          
          console.log('\n');

          // Track output
          const assistantMessage = { role: 'assistant' as const, content: fullResponse };
          history.push(assistantMessage);
          sessionTracker.trackOutput(assistantMessage);

        } catch (error) {
          console.error('Error:', error instanceof Error ? error.message : error);
        }

        prompt();
      });
    };

    prompt();
  });

// Skill command
program
  .command('skill')
  .description('Manage and run skills')
  .argument('[name]', 'Skill name to run')
  .option('-l, --list', 'List available skills')
  .option('-m, --model <model>', 'Model to use')
  .option('-c, --config <path>', 'Path to config file')
  .option('-i, --input <text>', 'Input for the skill')
  .option('--max-budget-usd <amount>', 'Maximum budget in USD', parseFloat)
  .action(async (name, options) => {
    const config = await loadConfig(options.config);
    const skills = await loadAllSkills();

    if (options.list || !name) {
      console.log('Available skills:\n');
      for (const skill of skills) {
        console.log(`  ${skill.name}`);
        console.log(`    ${skill.description}`);
        if (skill.trigger) {
          console.log(`    Trigger: /${skill.trigger}/`);
        }
        console.log();
      }
      return;
    }

    const skill = skills.find(s => s.name === name);
    if (!skill) {
      console.error(`Skill "${name}" not found.`);
      console.log('Available skills:', skills.map(s => s.name).join(', '));
      process.exit(1);
    }

    const modelString = options.model || config.defaults?.main || 'ollama/llama3.3:70b';
    const { provider: providerName, model } = parseModelString(modelString);
    const providerConfig = config.providers[providerName];
    
    if (!providerConfig) {
      console.error(`Provider "${providerName}" not configured.`);
      process.exit(1);
    }

    const providers = createProviders(config.providers);
    const provider = providers.get(providerName);
    
    if (!provider) {
      console.error(`Failed to create provider: ${providerName}`);
      process.exit(1);
    }

    const input = options.input || 'Please assist with the task.';
    
    console.log(`Running skill: ${skill.name}`);
    console.log(`Model: ${modelString}`);
    if (options.maxBudgetUsd) {
      console.log(`Budget: $${options.maxBudgetUsd.toFixed(2)}`);
    }
    console.log();

    await runSkill(skill, input, provider, model);
  });

// Config command
program
  .command('config')
  .description('Show current configuration')
  .option('-c, --config <path>', 'Path to config file')
  .action(async (options) => {
    const config = await loadConfig(options.config);
    console.log(stringify(config));
  });

// Models command
program
  .command('models')
  .description('List available models')
  .option('-c, --config <path>', 'Path to config file')
  .action(async (options) => {
    const config = await loadConfig(options.config);
    const providers = createProviders(config.providers);

    for (const [name, provider] of providers) {
      console.log(`\n${name}:`);
      try {
        const models = await provider.listModels();
        for (const model of models) {
          console.log(`  - ${name}/${model}`);
        }
      } catch (error) {
        console.log(`  (unable to list models: ${error instanceof Error ? error.message : error})`);
      }
    }
  });

// Subagent command
program
  .command('subagent')
  .description('Spawn a subagent for a task')
  .argument('<prompt>', 'Task for the subagent')
  .option('-m, --model <model>', 'Model to use')
  .option('-c, --config <path>', 'Path to config file')
  .option('--wait', 'Wait for completion', true)
  .option('--max-budget-usd <amount>', 'Maximum budget in USD', parseFloat)
  .action(async (prompt, options) => {
    const config = await loadConfig(options.config);
    const pool = new SubagentPool({
      config,
      defaultModel: options.model || config.defaults?.subagent,
    });

    console.log('Spawning subagent...');
    if (options.maxBudgetUsd) {
      console.log(`Budget: $${options.maxBudgetUsd.toFixed(2)}`);
    }
    const taskId = await pool.spawn(prompt, options.model);
    
    if (options.wait) {
      console.log('Waiting for completion...\n');
      const task = await pool.waitFor(taskId, 120000);
      
      if (task.status === 'completed') {
        console.log('Result:');
        console.log(task.result);
      } else {
        console.error('Task failed:', task.error);
        process.exit(1);
      }
    } else {
      console.log(`Task ID: ${taskId}`);
    }
  });

// Pricing command - show model pricing info
program
  .command('pricing')
  .description('Show model pricing information')
  .action(() => {
    const { MODEL_PRICING } = require('../context/costs');
    
    console.log('\nModel Pricing (USD per 1M tokens)\n');
    console.log('Model                      Input    Output');
    console.log('─────────────────────────────────────────────');
    
    const sorted = Object.entries(MODEL_PRICING)
      .filter(([key]) => key !== 'default')
      .sort((a, b) => (a[1] as any).inputPer1M - (b[1] as any).inputPer1M);
    
    for (const [model, pricing] of sorted) {
      const p = pricing as { inputPer1M: number; outputPer1M: number };
      if (p.inputPer1M === 0) {
        console.log(`${model.padEnd(25)} FREE     FREE`);
      } else {
        console.log(`${model.padEnd(25)} $${p.inputPer1M.toFixed(2).padStart(5)}   $${p.outputPer1M.toFixed(2).padStart(5)}`);
      }
    }
    console.log();
  });

program.parse();
