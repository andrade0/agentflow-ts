import * as readline from 'readline';
import { stdin as input, stdout as output } from 'process';
import { loadConfig } from '../config';
import { createProviders, parseModelString } from '../providers';
import { loadAllSkills, matchSkills } from '../skills';
import type { Skill, Message, Provider } from '../types';
import { SessionTracker } from '../context';

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
};

export class REPL {
  private provider: Provider;
  private skills: Skill[];
  private history: Message[] = [];
  private rl: readline.Interface;
  private running = false;
  private sessionTracker: SessionTracker;
  private maxBudget?: number;
  private currentModel: string;
  private currentProvider: string;

  constructor(
    provider: Provider, 
    skills: Skill[],
    options: { maxBudget?: number; model?: string; providerName?: string } = {}
  ) {
    this.provider = provider;
    this.skills = skills;
    this.maxBudget = options.maxBudget;
    
    this.currentProvider = options.providerName || 'ollama';
    this.currentModel = options.model || 'llama3.3';
    
    this.sessionTracker = new SessionTracker({
      model: this.currentModel,
      provider: this.currentProvider,
      maxBudget: options.maxBudget,
    });
    
    this.rl = readline.createInterface({
      input,
      output,
      prompt: `${colors.green}${colors.bold}You > ${colors.reset}`,
    });
  }

  async run(): Promise<void> {
    this.running = true;
    this.printWelcome();

    this.rl.on('close', () => {
      this.printSessionSummary();
      console.log('\n\nSession ended. Goodbye!');
      process.exit(0);
    });

    this.rl.on('SIGINT', () => {
      this.printSessionSummary();
      console.log('\n\nSession ended. Goodbye!');
      process.exit(0);
    });

    await this.loop();
  }

  private async loop(): Promise<void> {
    while (this.running) {
      // Check budget before each turn
      if (this.sessionTracker.isBudgetExceeded()) {
        console.log(`\n${colors.red}${colors.bold}🛑 Budget exceeded! Session stopped.${colors.reset}`);
        console.log(`Use /cost to see details.\n`);
        this.running = false;
        break;
      }
      
      // Show budget warning if needed
      const warning = this.sessionTracker.getBudgetWarning();
      if (warning) {
        console.log(`${colors.yellow}${warning}${colors.reset}`);
      }
      
      const userInput = await this.prompt();
      
      if (!userInput.trim()) continue;
      
      if (this.handleCommand(userInput)) continue;
      
      await this.processInput(userInput);
    }
  }

  private prompt(): Promise<string> {
    // Show context status in prompt
    const stats = this.sessionTracker.getStats();
    
    // Color based on usage
    let statusColor = colors.green;
    if (stats.tokens.contextPercentage >= 90) statusColor = colors.red;
    else if (stats.tokens.contextPercentage >= 70) statusColor = colors.yellow;
    else if (stats.tokens.contextPercentage >= 50) statusColor = colors.cyan;
    
    // Show mini status
    const miniStatus = `${colors.dim}[${statusColor}${stats.tokens.contextPercentage}%${colors.dim}]${colors.reset}`;
    
    return new Promise((resolve) => {
      this.rl.question(`${miniStatus} ${colors.green}${colors.bold}You > ${colors.reset}`, (answer) => {
        resolve(answer);
      });
    });
  }

  private printWelcome(): void {
    console.log();
    console.log(`${colors.cyan}${colors.bold}╭─────────────────────────────────────────────────────────────╮${colors.reset}`);
    console.log(`${colors.cyan}${colors.bold}│                    AgentFlow TS v0.1.0                      │${colors.reset}`);
    console.log(`${colors.cyan}${colors.bold}│                Superpowers for everyone 🚀                  │${colors.reset}`);
    console.log(`${colors.cyan}${colors.bold}╰─────────────────────────────────────────────────────────────╯${colors.reset}`);
    console.log();
    console.log(`${colors.gray}Provider: ${this.currentProvider} | Model: ${this.currentModel}${colors.reset}`);
    if (this.maxBudget) {
      console.log(`${colors.gray}Budget: $${this.maxBudget.toFixed(2)}${colors.reset}`);
    }
    console.log(`${colors.gray}Type /help for commands, /quit to exit${colors.reset}`);
    console.log();
  }

  private printSessionSummary(): void {
    const stats = this.sessionTracker.getStats();
    const duration = Math.round(stats.duration / 1000);
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    
    console.log();
    console.log(`${colors.cyan}${colors.bold}Session Summary${colors.reset}`);
    console.log(`${colors.gray}───────────────────────────────────${colors.reset}`);
    console.log(`${colors.gray}Duration:${colors.reset} ${mins}m ${secs}s`);
    console.log(`${colors.gray}Messages:${colors.reset} ${stats.messages}`);
    console.log(`${colors.gray}Tokens:${colors.reset} ${stats.tokens.total.toLocaleString()} (${stats.tokens.input.toLocaleString()} in / ${stats.tokens.output.toLocaleString()} out)`);
    
    if (stats.costs.isLocal) {
      console.log(`${colors.green}Cost: $0.00 (local model)${colors.reset}`);
    } else {
      console.log(`${colors.gray}Cost:${colors.reset} $${stats.costs.current.toFixed(4)}`);
    }
  }

  private handleCommand(input: string): boolean {
    if (!input.startsWith('/')) return false;

    const parts = input.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ');

    switch (cmd) {
      case '/quit':
      case '/exit':
      case '/q':
        this.printSessionSummary();
        console.log('Session ended. Goodbye!');
        this.running = false;
        process.exit(0);
        return true;

      case '/help':
      case '/h':
        this.printHelp();
        return true;

      case '/clear':
        this.history = [];
        this.sessionTracker.reset();
        console.log('Conversation and tracking cleared.');
        return true;

      case '/skills':
        this.listSkills();
        return true;

      case '/model':
        if (parts[1]) {
          this.currentModel = parts[1];
          this.sessionTracker.setModel(parts[1]);
          console.log(`Model changed to: ${parts[1]}`);
        } else {
          console.log(`Current model: ${this.currentModel}`);
        }
        return true;

      case '/provider':
        if (parts[1]) {
          this.currentProvider = parts[1];
          this.sessionTracker.setModel(this.currentModel, parts[1]);
          console.log(`Provider changed to: ${parts[1]}`);
        } else {
          console.log(`Current provider: ${this.currentProvider}`);
        }
        return true;

      case '/history':
        this.printHistory();
        return true;

      case '/context':
        this.showContext();
        return true;

      case '/cost':
        this.showCost();
        return true;

      case '/compact':
        this.compactConversation(args || undefined);
        return true;

      case '/status':
        this.showStatus();
        return true;

      case '/budget':
        if (parts[1]) {
          const newBudget = parseFloat(parts[1]);
          if (!isNaN(newBudget) && newBudget > 0) {
            this.maxBudget = newBudget;
            this.sessionTracker.setBudget(newBudget);
            console.log(`Budget set to: $${newBudget.toFixed(2)}`);
          } else {
            console.log(`${colors.red}Invalid budget amount${colors.reset}`);
          }
        } else {
          if (this.maxBudget) {
            const stats = this.sessionTracker.getStats();
            const remaining = Math.max(0, this.maxBudget - stats.costs.current);
            console.log(`Budget: $${this.maxBudget.toFixed(2)}`);
            console.log(`Spent:  $${stats.costs.current.toFixed(4)}`);
            console.log(`Remaining: $${remaining.toFixed(4)}`);
          } else {
            console.log('No budget set. Use /budget <amount> to set one.');
          }
        }
        return true;

      default:
        console.log(`${colors.yellow}Unknown command: ${cmd} (type /help for available commands)${colors.reset}`);
        return true;
    }
  }

  private printHelp(): void {
    console.log();
    console.log(`${colors.cyan}Available Commands:${colors.reset}`);
    console.log();
    console.log(`  ${colors.bold}/help, /h${colors.reset}           Show this help message`);
    console.log(`  ${colors.bold}/quit, /exit, /q${colors.reset}    Exit the session`);
    console.log(`  ${colors.bold}/clear${colors.reset}              Clear conversation history`);
    console.log(`  ${colors.bold}/skills${colors.reset}             List available skills`);
    console.log(`  ${colors.bold}/model [name]${colors.reset}       Show or change current model`);
    console.log(`  ${colors.bold}/provider [name]${colors.reset}    Show or change current provider`);
    console.log(`  ${colors.bold}/history${colors.reset}            Show conversation history`);
    console.log();
    console.log(`${colors.cyan}Context & Costs:${colors.reset}`);
    console.log();
    console.log(`  ${colors.bold}/context${colors.reset}            Show context usage visualization`);
    console.log(`  ${colors.bold}/cost${colors.reset}               Show session costs breakdown`);
    console.log(`  ${colors.bold}/compact [focus]${colors.reset}    Compact conversation history`);
    console.log(`  ${colors.bold}/status${colors.reset}             Show session statistics`);
    console.log(`  ${colors.bold}/budget [amount]${colors.reset}    Show or set budget limit`);
    console.log();
    console.log(`${colors.gray}  Tip: Just type naturally to start working!${colors.reset}`);
    console.log();
  }

  private listSkills(): void {
    console.log();
    console.log(`${colors.cyan}Available Skills:${colors.reset}`);
    console.log();
    for (const skill of this.skills) {
      console.log(`  • ${skill.name}`);
      console.log(`${colors.gray}    ${skill.description}${colors.reset}`);
    }
    console.log();
  }

  private printHistory(): void {
    if (this.history.length === 0) {
      console.log('No conversation history.');
      return;
    }

    console.log();
    for (const msg of this.history) {
      if (msg.role === 'user') {
        console.log(`${colors.green}You: ${msg.content}${colors.reset}`);
      } else {
        const truncated = msg.content.length > 100 
          ? msg.content.slice(0, 100) + '...' 
          : msg.content;
        console.log(`${colors.cyan}Agent: ${truncated}${colors.reset}`);
      }
    }
    console.log();
  }

  private showContext(): void {
    this.sessionTracker.setMessages(this.history);
    console.log(this.sessionTracker.visualizeContext());
  }

  private showCost(): void {
    console.log(this.sessionTracker.visualizeCosts());
  }

  private async compactConversation(focus?: string): Promise<void> {
    if (this.history.length < 4) {
      console.log('Not enough messages to compact.');
      return;
    }
    
    console.log(`${colors.cyan}Compacting conversation...${colors.reset}`);
    if (focus) {
      console.log(`${colors.gray}Focus: ${focus}${colors.reset}`);
    }
    
    this.sessionTracker.setMessages(this.history);
    
    try {
      const result = await this.sessionTracker.compact({
        focus,
        provider: this.provider,
      });
      
      this.history = result.messages;
      
      console.log();
      console.log(`${colors.green}✓ Compaction complete${colors.reset}`);
      console.log(`${colors.gray}  Original: ${result.originalTokens.toLocaleString()} tokens${colors.reset}`);
      console.log(`${colors.gray}  After: ${result.compactedTokens.toLocaleString()} tokens${colors.reset}`);
      console.log(`${colors.gray}  Saved: ${result.savedTokens.toLocaleString()} tokens (${result.savedPercentage}%)${colors.reset}`);
      console.log();
      
      if (result.summary) {
        console.log(`${colors.cyan}Summary:${colors.reset}`);
        console.log(`${colors.gray}${result.summary.slice(0, 200)}${result.summary.length > 200 ? '...' : ''}${colors.reset}`);
        console.log();
      }
    } catch (error) {
      console.log(`${colors.red}Compaction failed: ${error}${colors.reset}`);
    }
  }

  private showStatus(): void {
    const stats = this.sessionTracker.getStats();
    const duration = Math.round(stats.duration / 1000);
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    
    let contextColor = colors.green;
    if (stats.tokens.contextPercentage >= 90) contextColor = colors.red;
    else if (stats.tokens.contextPercentage >= 70) contextColor = colors.yellow;
    else if (stats.tokens.contextPercentage >= 50) contextColor = colors.cyan;
    
    console.log();
    console.log(`${colors.cyan}${colors.bold}Session Status${colors.reset}`);
    console.log(`${colors.gray}───────────────────────────────────${colors.reset}`);
    console.log(`${colors.gray}Provider:${colors.reset}  ${this.currentProvider}`);
    console.log(`${colors.gray}Model:${colors.reset}     ${this.currentModel}`);
    console.log(`${colors.gray}Duration:${colors.reset}  ${mins}m ${secs}s`);
    console.log(`${colors.gray}Messages:${colors.reset}  ${stats.messages}`);
    console.log();
    console.log(`${colors.cyan}Tokens:${colors.reset}`);
    console.log(`  ${colors.gray}Input:${colors.reset}   ${stats.tokens.input.toLocaleString()}`);
    console.log(`  ${colors.gray}Output:${colors.reset}  ${stats.tokens.output.toLocaleString()}`);
    console.log(`  ${colors.gray}Total:${colors.reset}   ${stats.tokens.total.toLocaleString()}`);
    console.log(`  ${colors.gray}Context:${colors.reset} ${contextColor}${stats.tokens.contextUsed.toLocaleString()}/${stats.tokens.contextLimit.toLocaleString()} (${stats.tokens.contextPercentage}%)${colors.reset}`);
    console.log();
    console.log(`${colors.cyan}Cost:${colors.reset}`);
    if (stats.costs.isLocal) {
      console.log(`  ${colors.green}$0.00 (local model)${colors.reset}`);
    } else {
      console.log(`  ${colors.gray}Current:${colors.reset} $${stats.costs.current.toFixed(4)}`);
      if (this.maxBudget) {
        const remaining = Math.max(0, this.maxBudget - stats.costs.current);
        const budgetPercent = Math.round((stats.costs.current / this.maxBudget) * 100);
        console.log(`  ${colors.gray}Budget:${colors.reset}  $${this.maxBudget.toFixed(2)} (${budgetPercent}% used)`);
        console.log(`  ${colors.gray}Left:${colors.reset}    $${remaining.toFixed(4)}`);
      }
    }
    console.log();
  }

  private async processInput(userInput: string): Promise<void> {
    // Track input message
    const userMessage: Message = { role: 'user', content: userInput };
    this.history.push(userMessage);
    this.sessionTracker.trackInput(userMessage);

    // Match skill
    const matchedSkill = matchSkills(userInput, this.skills)[0];
    if (matchedSkill) {
      console.log(`${colors.gray}\n[Skill: ${matchedSkill.skill.name}]${colors.reset}`);
    }

    // Print agent prompt
    process.stdout.write(`\n${colors.cyan}${colors.bold}Agent > ${colors.reset}`);

    try {
      // Stream response
      let fullResponse = '';
      
      for await (const chunk of this.provider.chat(this.history, { model: this.currentModel })) {
        process.stdout.write(chunk);
        fullResponse += chunk;
        // Track streaming tokens
        this.sessionTracker.trackStreamingChunk(chunk);
      }

      console.log('\n');

      // Add response to history and track
      const assistantMessage: Message = { role: 'assistant', content: fullResponse };
      this.history.push(assistantMessage);
      this.sessionTracker.trackOutput(assistantMessage);

    } catch (error) {
      console.log(`${colors.red}Error: ${error}${colors.reset}\n`);
    }
  }
}

export async function startREPL(options: { maxBudget?: number } = {}): Promise<void> {
  const config = await loadConfig();
  const modelString = config.defaults?.main || 'ollama/llama3.3:70b';
  const { provider: providerName, model } = parseModelString(modelString);
  
  const providers = createProviders(config.providers);
  const provider = providers.get(providerName);
  
  if (!provider) {
    console.error(`Failed to create provider: ${providerName}`);
    process.exit(1);
  }
  
  const skills = await loadAllSkills();

  const repl = new REPL(provider, skills, {
    maxBudget: options.maxBudget,
    model,
    providerName,
  });
  await repl.run();
}
