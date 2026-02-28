# 🚀 AgentFlow TS

**Superpowers for everyone.** The TypeScript/Bun implementation of AgentFlow — bringing structured AI workflows to the JavaScript ecosystem.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Bun](https://img.shields.io/badge/Bun-1.0+-f9f1e1?logo=bun)](https://bun.sh/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript)](https://www.typescriptlang.org/)

---

## Why AgentFlow TS?

The same powerful workflows as [AgentFlow](https://github.com/agentflow/agentflow) (Go), but for the JavaScript/TypeScript ecosystem.

Perfect for:
- **JS/TS developers** who want native tooling
- **Bun users** who want blazing fast startup
- **Plugin developers** who want to extend in TypeScript
- **Prototyping** with hot reload

## Features

### ⚡ Bun-Powered Performance

```bash
# Install
bun add -g agentflow-ts

# Run (startup < 200ms)
agentflow run "build a Next.js dashboard"
```

### 🧩 TypeScript-Native

```typescript
import { AgentFlow, OllamaProvider } from 'agentflow-ts';

const agent = new AgentFlow({
  provider: new OllamaProvider({
    model: 'llama3.3:70b'
  })
});

const result = await agent.run('add user authentication');
```

### 🔌 Easy Plugin Development

```typescript
// skills/my-skill/index.ts
import { defineSkill } from 'agentflow-ts';

export default defineSkill({
  name: 'my-skill',
  description: 'Does something cool',
  triggers: ['cool', 'awesome'],
  
  async run(context) {
    // Your skill logic
    await context.ask('What specifically do you want?');
    await context.execute('npm install something');
    return context.complete('Done!');
  }
});
```

### 🌊 Streaming by Default

```typescript
for await (const chunk of agent.stream('explain this code')) {
  process.stdout.write(chunk);
}
```

## Installation

### Global CLI

```bash
# With Bun
bun add -g agentflow-ts

# With npm
npm install -g agentflow-ts

# With pnpm
pnpm add -g agentflow-ts
```

### As Library

```bash
bun add agentflow-ts
```

## Quick Start

### 1. Initialize

```bash
cd your-project
agentflow init
```

### 2. Configure

```typescript
// .agentflow/config.ts
import { defineConfig } from 'agentflow-ts';

export default defineConfig({
  providers: {
    ollama: {
      baseUrl: 'http://localhost:11434',
    },
    groq: {
      apiKey: process.env.GROQ_API_KEY,
    },
  },
  defaults: {
    provider: 'ollama',
    model: 'llama3.3:70b',
  },
});
```

### 3. Run

```bash
agentflow run "add a REST API for todos"
```

## API Reference

### AgentFlow Class

```typescript
import { AgentFlow } from 'agentflow-ts';

const agent = new AgentFlow(config);

// Run a task
const result = await agent.run('build feature X');

// Stream responses
for await (const chunk of agent.stream('explain this')) {
  console.log(chunk);
}

// Run specific skill
await agent.skill('brainstorming').run();

// Spawn subagent
const subagent = agent.spawn({
  model: 'codellama:34b',
  task: 'implement login form'
});
```

### Providers

```typescript
import {
  OllamaProvider,
  GroqProvider,
  TogetherProvider,
  OpenAICompatProvider,
} from 'agentflow-ts';

// Ollama (local)
const ollama = new OllamaProvider({
  baseUrl: 'http://localhost:11434',
  model: 'llama3.3:70b',
});

// Groq (free tier)
const groq = new GroqProvider({
  apiKey: process.env.GROQ_API_KEY,
  model: 'llama-3.3-70b-versatile',
});

// Together
const together = new TogetherProvider({
  apiKey: process.env.TOGETHER_API_KEY,
  model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
});

// Any OpenAI-compatible API
const custom = new OpenAICompatProvider({
  baseUrl: 'https://api.myservice.com/v1',
  apiKey: process.env.MY_API_KEY,
  model: 'custom-model',
});
```

### Skill Definition

```typescript
import { defineSkill, SkillContext } from 'agentflow-ts';

export default defineSkill({
  name: 'my-skill',
  description: 'When to use this skill',
  triggers: ['keyword1', 'keyword2'],
  priority: 50,  // Higher = more likely to match
  
  async run(ctx: SkillContext) {
    // Read files
    const content = await ctx.read('package.json');
    
    // Ask questions
    const answer = await ctx.ask('What framework?', {
      choices: ['React', 'Vue', 'Svelte'],
    });
    
    // Execute commands
    const output = await ctx.exec('npm test');
    
    // Generate with LLM
    const code = await ctx.generate('Write a function that...');
    
    // Write files
    await ctx.write('src/component.tsx', code);
    
    // Spawn subagent
    const result = await ctx.subagent({
      task: 'review this code',
      model: 'qwen2.5-coder:32b',
    });
    
    return ctx.complete('Done!');
  },
});
```

## CLI Commands

```bash
# Initialize project
agentflow init

# Run task (auto-matches skill)
agentflow run "build a feature"

# Run specific skill
agentflow skill brainstorming
agentflow skill run systematic-debugging

# List skills
agentflow skill list

# Configuration
agentflow config show
agentflow config set provider groq
agentflow config set model llama-3.3-70b-versatile

# Interactive TUI
agentflow tui

# Start as server (for IDE integrations)
agentflow serve --port 3000
```

## Configuration

### Config File

`.agentflow/config.ts`:

```typescript
import { defineConfig } from 'agentflow-ts';

export default defineConfig({
  project: {
    name: 'my-app',
    language: 'typescript',
    testCommand: 'bun test',
    lintCommand: 'bun run lint',
  },
  
  providers: {
    ollama: {
      baseUrl: 'http://localhost:11434',
    },
    groq: {
      apiKey: process.env.GROQ_API_KEY,
    },
    together: {
      apiKey: process.env.TOGETHER_API_KEY,
    },
  },
  
  defaults: {
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
  },
  
  roles: {
    main: {
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
    },
    subagent: {
      provider: 'ollama',
      model: 'codellama:34b',
    },
    reviewer: {
      provider: 'together',
      model: 'Qwen/Qwen2.5-Coder-32B-Instruct',
    },
  },
  
  skills: {
    // Custom skill directories
    paths: ['./skills', '~/.agentflow/skills'],
  },
});
```

### Environment Variables

```bash
# API Keys
GROQ_API_KEY=gsk_...
TOGETHER_API_KEY=...
OPENAI_API_KEY=sk-...

# Ollama (optional, defaults to localhost)
OLLAMA_HOST=http://localhost:11434

# Defaults
AGENTFLOW_PROVIDER=groq
AGENTFLOW_MODEL=llama-3.3-70b-versatile
```

## Skills

### Built-in Skills

Same skills as AgentFlow Go, with TypeScript adaptations:

| Skill | Triggers | Purpose |
|-------|----------|---------|
| brainstorming | build, create, feature | Design phase |
| writing-plans | plan, tasks | Task breakdown |
| subagent-driven-development | execute, implement | Parallel execution |
| test-driven-development | test, TDD | RED-GREEN-REFACTOR |
| systematic-debugging | bug, error | Root cause analysis |
| verification-before-completion | done, complete | Evidence checks |

### Skill Format

Skills can be markdown (`.md`) or TypeScript (`.ts`):

**Markdown (compatible with Go version):**
```markdown
---
name: my-skill
description: "When to use"
triggers: ["keyword"]
---

# My Skill

## Process
1. Do thing
2. Do other thing
```

**TypeScript (TS-specific features):**
```typescript
export default defineSkill({
  name: 'my-skill',
  // ... with full programmatic control
});
```

## Bun vs Node

AgentFlow TS is optimized for Bun but works with Node.js:

| Feature | Bun | Node |
|---------|-----|------|
| Startup | ~100ms | ~500ms |
| TypeScript | Native | Requires tsx |
| Config | .ts native | .ts via loader |
| Tests | bun test | jest/vitest |

For Node.js:
```bash
# Install
npm install -g agentflow-ts

# Run with tsx
npx tsx $(which agentflow)
```

## Contributing

```bash
git clone https://github.com/agentflow/agentflow-ts.git
cd agentflow-ts
bun install
bun test
bun run build
```

## Related Projects

- [AgentFlow (Go)](https://github.com/agentflow/agentflow) — The Go implementation
- [Superpowers](https://github.com/obra/superpowers) — The original inspiration

## License

MIT License

---

**Star ⭐ if you find this useful!**

[Documentation](https://agentflow.dev/docs/ts) · [Discord](https://discord.gg/agentflow) · [Twitter](https://twitter.com/agentflow_dev)
