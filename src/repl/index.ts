import * as readline from 'readline';
import { stdin as input, stdout as output } from 'process';
import { Config, loadConfig } from '../config';
import { createProvider, Provider } from '../providers';
import { SkillManager } from '../skills';
import { Agent, Message } from '../agents';

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
  private config: Config;
  private provider: Provider;
  private skillManager: SkillManager;
  private agent: Agent;
  private history: Message[] = [];
  private rl: readline.Interface;
  private running = false;

  constructor(config: Config, provider: Provider, skillManager: SkillManager) {
    this.config = config;
    this.provider = provider;
    this.skillManager = skillManager;
    this.agent = new Agent(provider, skillManager, config);
    
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
      console.log('\n\nSession ended. Goodbye!');
      process.exit(0);
    });

    this.rl.on('SIGINT', () => {
      console.log('\n\nSession ended. Goodbye!');
      process.exit(0);
    });

    await this.loop();
  }

  private async loop(): Promise<void> {
    while (this.running) {
      const input = await this.prompt();
      
      if (!input.trim()) continue;
      
      if (this.handleCommand(input)) continue;
      
      await this.processInput(input);
    }
  }

  private prompt(): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(`${colors.green}${colors.bold}You > ${colors.reset}`, (answer) => {
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
    console.log(`${colors.gray}Provider: ${this.config.defaults?.provider || 'ollama'} | Model: ${this.config.defaults?.model || 'llama3.3'}${colors.reset}`);
    console.log(`${colors.gray}Type /help for commands, /quit to exit${colors.reset}`);
    console.log();
  }

  private handleCommand(input: string): boolean {
    if (!input.startsWith('/')) return false;

    const parts = input.split(/\s+/);
    const cmd = parts[0].toLowerCase();

    switch (cmd) {
      case '/quit':
      case '/exit':
      case '/q':
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
        console.log('Conversation cleared.');
        return true;

      case '/skills':
        this.listSkills();
        return true;

      case '/model':
        if (parts[1]) {
          this.config.defaults = this.config.defaults || {};
          this.config.defaults.model = parts[1];
          console.log(`Model changed to: ${parts[1]}`);
        } else {
          console.log(`Current model: ${this.config.defaults?.model || 'not set'}`);
        }
        return true;

      case '/provider':
        if (parts[1]) {
          this.config.defaults = this.config.defaults || {};
          this.config.defaults.provider = parts[1];
          console.log(`Provider changed to: ${parts[1]}`);
        } else {
          console.log(`Current provider: ${this.config.defaults?.provider || 'not set'}`);
        }
        return true;

      case '/history':
        this.printHistory();
        return true;

      case '/compact':
        console.log('Compacting conversation history...');
        // TODO: Implement compaction
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
    console.log('  /help, /h        Show this help message');
    console.log('  /quit, /exit, /q Exit the session');
    console.log('  /clear           Clear conversation history');
    console.log('  /skills          List available skills');
    console.log('  /model [name]    Show or change current model');
    console.log('  /provider [name] Show or change current provider');
    console.log('  /history         Show conversation history');
    console.log('  /compact         Compact conversation to save context');
    console.log();
    console.log(`${colors.gray}  Tip: Just type naturally to start working!${colors.reset}`);
    console.log();
  }

  private listSkills(): void {
    const skills = this.skillManager.list();
    console.log();
    console.log(`${colors.cyan}Available Skills:${colors.reset}`);
    console.log();
    for (const skill of skills) {
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

  private async processInput(input: string): Promise<void> {
    // Add to history
    this.history.push({ role: 'user', content: input });

    // Match skill
    const matchedSkill = this.skillManager.match(input);
    if (matchedSkill) {
      console.log(`${colors.gray}\n[Skill: ${matchedSkill.name}]${colors.reset}`);
    }

    // Print agent prompt
    process.stdout.write(`\n${colors.cyan}${colors.bold}Agent > ${colors.reset}`);

    try {
      // Stream response
      let fullResponse = '';
      
      for await (const chunk of this.agent.streamChat(this.history, matchedSkill)) {
        process.stdout.write(chunk);
        fullResponse += chunk;
      }

      console.log('\n');

      // Add response to history
      this.history.push({ role: 'assistant', content: fullResponse });

    } catch (error) {
      console.log(`${colors.red}Error: ${error}${colors.reset}\n`);
    }
  }
}

export async function startREPL(): Promise<void> {
  const config = await loadConfig();
  const provider = createProvider(config);
  const skillManager = new SkillManager(config.skills?.paths || []);
  await skillManager.load();

  const repl = new REPL(config, provider, skillManager);
  await repl.run();
}
