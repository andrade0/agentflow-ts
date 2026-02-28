# 🚀 AgentFlow TS

**Superpowers for everyone.** An open-source agentic coding tool that lives in your terminal — like Claude Code, but for free and local models. TypeScript/Bun implementation.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Bun](https://img.shields.io/badge/Bun-1.0+-f9f1e1?logo=bun)](https://bun.sh/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript)](https://www.typescriptlang.org/)

---

## Why AgentFlow?

Claude Code is amazing, but requires an Anthropic subscription. AgentFlow brings the same powerful experience to everyone:

| Feature | Claude Code | AgentFlow |
|---------|-------------|-----------|
| Models | Claude only | Ollama, Groq, Together, any model |
| Cost | $20+/month | Free (local) or cheap |
| Privacy | Cloud API | Run fully offline |
| Open Source | No | Yes, MIT licensed |

## Features

### 🖥️ Full Terminal UI

```
🚀 AgentFlow TS v0.1.0
ollama/llama3.3 • Enter to send • /help for commands

You 14:32
build a REST API for users

⚡ Skill: brainstorming

Agent 14:32 ●
Before I start coding, I have some questions...

╭──────────────────────────────────────────────────────────╮
│ > Type a message...                                      │
╰──────────────────────────────────────────────────────────╯
┌──────────────────────────────────────────────────────────┐
│ ollama/llama3.3 │ 1.2k tokens │ $0.00 │ ↑5 msgs • 3m    │
└──────────────────────────────────────────────────────────┘
```

### 📚 Claude Code-Compatible Features

- **Session persistence** — Save and resume conversations
- **Slash commands** — /help, /model, /compact, /export...
- **Keyboard shortcuts** — History navigation, background tasks
- **Streaming responses** — Real-time output with spinners
- **Token tracking** — Know your context usage
- **Cost estimation** — Track spending
- **Themes** — Customize your experience
- **React/Ink TUI** — Modern terminal UI

### 🧠 Composable Skills

Built-in skills for structured workflows:

- **brainstorming** — Mandatory design before coding
- **writing-plans** — 2-5 minute task breakdown
- **subagent-driven-development** — Fresh agents per task
- **test-driven-development** — RED-GREEN-REFACTOR
- **systematic-debugging** — 4-phase root cause analysis
- **verification-before-completion** — Evidence before claims

## Installation

### Global CLI

```bash
# With Bun (recommended)
bun add -g agentflow-ts

# With npm
npm install -g agentflow-ts

# With pnpm
pnpm add -g agentflow-ts
```

### From Source

```bash
git clone https://github.com/andrade0/agentflow-ts.git
cd agentflow-ts
bun install
bun link
```

## Quick Start

### 1. Configure a Provider

```bash
# Create config directory
mkdir -p ~/.agentflow

# Create config file
cat > ~/.agentflow/config.yaml << 'EOF'
providers:
  ollama:
    baseUrl: http://localhost:11434
    models: [llama3.3:70b, codellama:34b]
  groq:
    apiKey: ${GROQ_API_KEY}
    models: [llama-3.3-70b-versatile]

defaults:
  provider: ollama
  model: llama3.3:70b
EOF
```

### 2. Start AgentFlow

```bash
# Start interactive session
agentflow

# Or with initial prompt
agentflow "explain this project"
```

## CLI Commands

```bash
# Interactive mode (default)
agentflow                      # Start TUI
agentflow "task"               # Start with prompt

# Session management
agentflow -c                   # Continue last session
agentflow -r <id|name>         # Resume specific session
agentflow --fork-session       # Fork when resuming

# Non-interactive
agentflow run "task"           # Execute and exit
cat file | agentflow -p "explain"  # Pipe content

# Configuration
agentflow init                 # Create .agentflow/
agentflow config               # Show config

# Skills & Models
agentflow skill                # List skills
agentflow skill brainstorming  # Run specific skill
agentflow models               # List available models
```

## Slash Commands

| Command | Description |
|---------|-------------|
| `/help` | Show all commands |
| `/quit`, `/exit` | Exit session |
| `/clear` | Clear conversation |
| `/compact [focus]` | Compact context |
| `/model [name]` | Show/change model |
| `/provider [name]` | Show/change provider |
| `/status` | Session statistics |
| `/cost` | Token usage & costs |
| `/context` | Visualize context |
| `/sessions` | List saved sessions |
| `/resume [id]` | Resume session |
| `/rename [name]` | Rename session |
| `/export [file]` | Export conversation |
| `/copy` | Copy last response |
| `/skills` | List skills |
| `/theme` | Change theme |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+C` | Cancel / Exit |
| `Enter` | Send message |
| `Up/Down` | Navigate history |
| `Tab` | Autocomplete |

## Configuration

### Global Config (~/.agentflow/config.yaml)

```yaml
providers:
  ollama:
    baseUrl: http://localhost:11434
    models: [llama3.3:70b, codellama:34b, deepseek-coder:33b]
  
  groq:
    apiKey: ${GROQ_API_KEY}
    models: [llama-3.3-70b-versatile, mixtral-8x7b-32768]
  
  together:
    apiKey: ${TOGETHER_API_KEY}
    models: [meta-llama/Llama-3.3-70B-Instruct-Turbo]
  
  anthropic:
    apiKey: ${ANTHROPIC_API_KEY}
    models: [claude-sonnet-4-20250514]

defaults:
  provider: groq
  model: llama-3.3-70b-versatile

roles:
  main:
    provider: groq
    model: llama-3.3-70b-versatile
  subagent:
    provider: ollama
    model: codellama:34b
  reviewer:
    provider: together
    model: Qwen/Qwen2.5-Coder-32B-Instruct

skills:
  paths:
    - ./skills
    - ~/.agentflow/skills

session:
  autoSave: true
  maxSessions: 50
```

### Project Config (.agentflow/config.yaml)

```yaml
project:
  name: my-api
  language: typescript
  testCommand: bun test
  lintCommand: bun run lint
```

## API Usage

Use AgentFlow as a library:

```typescript
import { AgentFlow, OllamaProvider } from 'agentflow-ts';

const agent = new AgentFlow({
  provider: new OllamaProvider({
    baseUrl: 'http://localhost:11434',
    model: 'llama3.3:70b'
  })
});

// Simple query
const response = await agent.run('explain this code');
console.log(response);

// Streaming
for await (const chunk of agent.stream('write a function')) {
  process.stdout.write(chunk);
}

// With skills
const design = await agent.skill('brainstorming').run('build auth system');
```

## Skills

Skills are markdown files that define workflows:

```markdown
---
name: my-skill
description: "When to use this skill"
triggers: ["keyword1", "keyword2"]
priority: 50
---

# My Skill

## Process
1. Step one
2. Step two
...
```

Or TypeScript for programmatic control:

```typescript
// skills/my-skill/index.ts
import { defineSkill } from 'agentflow-ts';

export default defineSkill({
  name: 'my-skill',
  description: 'Does something cool',
  triggers: ['cool', 'awesome'],
  
  async run(ctx) {
    const answer = await ctx.ask('What do you want?');
    await ctx.exec('npm install');
    return ctx.complete('Done!');
  }
});
```

## Model Recommendations

| Use Case | Model | Provider |
|----------|-------|----------|
| General coding | llama-3.3-70b | Groq (free) |
| Code generation | codellama:34b | Ollama |
| Code review | Qwen2.5-Coder-32B | Together |
| Fast responses | llama-3.2-3b | Ollama |
| Best quality | claude-sonnet-4 | Anthropic |

### Free Tier Limits

| Provider | Free Tier |
|----------|-----------|
| Ollama | Unlimited (local) |
| Groq | 30 req/min |
| Together | $5 credit |

## Roadmap

- [x] Interactive TUI (React/Ink)
- [x] Streaming responses
- [x] Skill system
- [x] Subagent support
- [x] Multiple providers
- [ ] Session persistence
- [ ] Token counting
- [ ] Cost tracking
- [ ] Background tasks
- [ ] Vim mode
- [ ] MCP integration

## Related Projects

- [AgentFlow (Go)](https://github.com/andrade0/agentflow) — Go implementation
- [Superpowers](https://github.com/obra/superpowers) — Original inspiration
- [Claude Code](https://code.claude.com) — Anthropic's tool

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT License — Use it, fork it, build cool stuff.

---

**Star ⭐ if you find this useful!**

[Documentation](docs/) · [Issues](https://github.com/andrade0/agentflow-ts/issues)
