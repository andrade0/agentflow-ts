#!/usr/bin/env bun
import { Command } from 'commander';
import { loadConfig, getDefaultConfig } from '../config';
import { createProviders, parseModelString } from '../providers';
import { loadAllSkills, matchSkills, runSkill } from '../skills';
import { createAgentContext, runAgent, chat } from '../agents';
import { SubagentPool } from '../subagents';
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
  .action(async () => {
    // Default action: start interactive TUI
    const { startTUI } = await import('../tui/App');
    await startTUI();
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

    console.log(`Using ${modelString}\n`);

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
    let context = createAgentContext(config, skills);

    console.log(`AgentFlow Chat - ${modelString}`);
    console.log('Type /quit to exit, /skills to list skills\n');

    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const prompt = () => {
      rl.question('> ', async (input) => {
        const trimmed = input.trim();
        
        if (trimmed === '/quit' || trimmed === '/exit') {
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
          context = createAgentContext(config, skills);
          console.log('Context cleared.\n');
          prompt();
          return;
        }

        if (!trimmed) {
          prompt();
          return;
        }

        try {
          const result = await chat(trimmed, context, provider, model);
          context = result.context;
          console.log();
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
    console.log(`Model: ${modelString}\n`);

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
  .action(async (prompt, options) => {
    const config = await loadConfig(options.config);
    const pool = new SubagentPool({
      config,
      defaultModel: options.model || config.defaults?.subagent,
    });

    console.log('Spawning subagent...');
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

program.parse();
