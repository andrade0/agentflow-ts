# AgentFlow TS: A Free Claude Code Alternative for the JavaScript Ecosystem

*Built with Bun, React Ink, and zero API keys required.*

---

If you're a JavaScript/TypeScript developer, you've probably looked at Claude Code with envy. The structured workflows, the terminal UI, the way it thinks before it codes.

But then you saw the price tag. And the fact that all your code goes to Anthropic's cloud.

I built **AgentFlow TS** to solve both problems.

## What is AgentFlow TS?

AgentFlow TS is a **terminal-based AI coding assistant** built specifically for the JavaScript ecosystem. It runs on Bun, uses React Ink for the UI, and works with any open-source LLM.

```
🚀 AgentFlow TS v0.1.0
ollama/llama3.3:70b • Enter to send

You 14:32
build a Next.js dashboard with authentication

⚡ Skill: brainstorming

Agent 14:32 ●
Before I start, I have some questions:

1. Which auth provider? (NextAuth, Clerk, Auth0, custom)
2. Database for users? (Postgres, MongoDB, Prisma)
3. UI framework? (Tailwind, Chakra, shadcn/ui)

╭──────────────────────────────────────────────────────────╮
│ > ...                                                    │
╰──────────────────────────────────────────────────────────╯
┌──────────────────────────────────────────────────────────┐
│ llama3.3:70b │ 847 tokens (6%) │ FREE │ ↑3 msgs • 1m    │
└──────────────────────────────────────────────────────────┘
```

**No API keys. No cloud. Just local models.**

## Why TypeScript?

Three reasons I built a separate TypeScript version:

### 1. Native for JS Developers

If you're building Node/Bun/Deno apps, you probably want your tooling in the same ecosystem. AgentFlow TS is written in TypeScript, runs on Bun, and can be used as a library in your own projects.

### 2. React Ink UI

The terminal UI is built with [React Ink](https://github.com/vadimdemedes/ink) — React components rendered in the terminal. If you know React, you can extend the UI.

### 3. Library + CLI

AgentFlow TS works as both a CLI and a library:

```typescript
import { AgentFlow, OllamaProvider } from 'agentflow-ts';

const agent = new AgentFlow({
  provider: new OllamaProvider({
    model: 'llama3.3:70b'
  })
});

// Use in your own apps
for await (const chunk of agent.stream('refactor this function')) {
  process.stdout.write(chunk);
}
```

## Features

### Context Tracking & Visualization

One thing that frustrated me about other tools: you never know how much context you've used until you hit the limit.

AgentFlow TS shows you in real-time:

```
/context

Context Usage (23% of 128K)
████████░░░░░░░░░░░░░░░░░░░░░░ 29,440 / 128,000 tokens

Breakdown:
  System prompt:  2,100 tokens
  Conversation:  27,340 tokens
  
Status: 🟢 Plenty of room
```

Color-coded grid:
- 🟢 Green: < 50% used
- 🔵 Cyan: 50-70%
- 🟡 Yellow: 70-90%
- 🔴 Red: > 90%

### Smart Compaction

Running out of context? Compact it:

```
/compact focus on authentication logic

Compacted conversation from 45,000 to 12,000 tokens.
Preserved: authentication flows, JWT handling, middleware.
Summarized: initial setup, dependency discussion.
```

### Cost Tracking (Even When It's Free)

The status bar shows cost estimates. For Ollama models:

```
│ llama3.3:70b │ 1,247 tokens │ FREE │
```

This is intentional. I want people to see that **local models cost nothing**.

### Session Persistence

Every conversation is automatically saved:

```bash
agentflow -c              # Continue where you left off
agentflow -r my-feature   # Resume by name
agentflow sessions        # List all sessions
```

Sessions survive terminal crashes, machine reboots, everything.

### TypeScript Skills

Skills can be markdown OR TypeScript:

```typescript
// skills/review-pr/index.ts
import { defineSkill } from 'agentflow-ts';

export default defineSkill({
  name: 'review-pr',
  description: 'Review a pull request',
  triggers: ['review', 'pr', 'pull request'],
  
  async run(ctx) {
    const prUrl = await ctx.ask('What PR should I review?');
    const diff = await ctx.exec(`gh pr diff ${prUrl}`);
    
    return ctx.prompt(`
      Review this PR diff for:
      - Security issues
      - Performance problems
      - Code style
      
      ${diff}
    `);
  }
});
```

TypeScript skills have full access to:
- `ctx.ask()` — Ask the user a question
- `ctx.exec()` — Run shell commands
- `ctx.read()` — Read files
- `ctx.write()` — Write files
- `ctx.subagent()` — Spawn a sub-agent

## Installation

### Quick Start

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.3:70b

# Install AgentFlow TS
bun add -g agentflow-ts

# Start coding
agentflow
```

### As a Library

```bash
bun add agentflow-ts
```

```typescript
import { AgentFlow, OllamaProvider } from 'agentflow-ts';

const agent = new AgentFlow({
  provider: new OllamaProvider({ model: 'codellama:34b' })
});

const response = await agent.run('write a React hook for dark mode');
```

## Supported Backends

| Backend | Local | Remote | Notes |
|---------|-------|--------|-------|
| Ollama | ✅ | ✅ | Recommended |
| vLLM | ✅ | ✅ | Best for production |
| llama.cpp | ✅ | ✅ | Lightweight |
| LocalAI | ✅ | ✅ | Docker-friendly |
| LM Studio | ✅ | ❌ | GUI app |

All expose OpenAI-compatible APIs. AgentFlow TS works with any of them.

## Slash Commands

| Command | Description |
|---------|-------------|
| `/help` | Show all commands |
| `/context` | Visualize context usage |
| `/compact [focus]` | Compact conversation |
| `/cost` | Show token costs |
| `/sessions` | List saved sessions |
| `/resume [id]` | Resume a session |
| `/model [name]` | Change model |
| `/skills` | List available skills |

## Recommended Models

| Use Case | Model | Speed |
|----------|-------|-------|
| Best quality | llama3.3:70b | Slow |
| TypeScript | qwen2.5-coder:14b | Medium |
| Fast iteration | llama3.2:3b | Fast |
| Code review | deepseek-coder:33b | Medium |

## How It Compares

| Feature | Claude Code | AgentFlow TS |
|---------|-------------|--------------|
| Language | N/A | TypeScript |
| Runtime | N/A | Bun/Node |
| Models | Claude | Any open-source |
| Cost | $20+/mo | Free |
| Privacy | Cloud | Local |
| Context tracking | Basic | Visual grid |
| Cost tracking | Hidden | Transparent |
| Library usage | No | Yes |

## The Philosophy

I believe AI coding assistants should be:

1. **Free** — No subscriptions, no API costs
2. **Private** — Your code stays on your machine
3. **Open** — MIT license, fork it, modify it
4. **Transparent** — See token usage, costs, context

AgentFlow TS is all of these.

## Try It

```bash
# With Bun
bun add -g agentflow-ts

# With npm
npm install -g agentflow-ts

# Then just run
agentflow
```

Star the repo: [github.com/andrade0/agentflow-ts](https://github.com/andrade0/agentflow-ts)

---

**The JavaScript ecosystem deserves its own AI coding assistant.** One that's built with our tools, speaks our language, and doesn't require a cloud subscription.

AgentFlow TS is that tool.

*No API keys. No cloud. No costs. Just code.*

---

## About

Building open-source AI tools for developers. Also check out the Go version: [AgentFlow](https://github.com/andrade0/agentflow).

**Tags:** #TypeScript #JavaScript #Bun #React #AI #LLM #Ollama #OpenSource #CLI #DeveloperTools
