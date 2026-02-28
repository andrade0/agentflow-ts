# agentflow-ts

Agentic workflow framework for free/local LLMs. TypeScript implementation built with Bun.

## Features

- 🤖 **Universal Model Support** — Ollama, Groq, Together AI, OpenAI, Anthropic
- 📚 **Composable Skills** — Markdown-based skill definitions
- 🔄 **Subagent Workflows** — Fresh agents per task
- ⚡ **Streaming** — Real-time token streaming
- 🎯 **Skill Matching** — Automatic skill invocation based on input

## Installation

```bash
# Clone and install
git clone https://github.com/yourusername/agentflow-ts
cd agentflow-ts
bun install

# Or use directly
bunx agentflow-ts
```

## Quick Start

```bash
# Initialize in current directory
agentflow init

# Start interactive chat
agentflow chat

# Run with a prompt
agentflow run "Design a REST API for a todo app"

# Use a specific model
agentflow run -m groq/llama-3.3-70b-versatile "Explain recursion"
```

## Configuration

```yaml
# ~/.agentflow/config.yaml
providers:
  ollama:
    base_url: http://localhost:11434
    models:
      - llama3.3:70b
      - codellama:34b

  groq:
    api_key: ${GROQ_API_KEY}
    models:
      - llama-3.3-70b-versatile

  together:
    api_key: ${TOGETHER_API_KEY}
    models:
      - meta-llama/Llama-3.3-70B-Instruct-Turbo

defaults:
  main: groq/llama-3.3-70b-versatile
  subagent: ollama/llama3.3:70b
  reviewer: together/Qwen/Qwen2.5-Coder-32B-Instruct
```

## Skills

Skills are markdown files with frontmatter:

```markdown
---
name: brainstorming
description: Mandatory design phase before coding
trigger: (design|brainstorm|plan)
---
# Brainstorming Skill

You are entering brainstorming mode...

## Task
{{input}}
```

Place skills in:
- `.agentflow/skills/` (project-specific)
- `~/.agentflow/skills/` (global)

## Commands

| Command | Description |
|---------|-------------|
| `agentflow init` | Initialize in current directory |
| `agentflow chat` | Interactive chat REPL |
| `agentflow run <prompt>` | Run agent with prompt |
| `agentflow skill [name]` | List or run skills |
| `agentflow config` | Show configuration |
| `agentflow models` | List available models |
| `agentflow subagent <prompt>` | Spawn a subagent |

## Development

```bash
# Run tests
bun test

# Type check
bun run typecheck

# Build
bun run build
```

## API Usage

```typescript
import { 
  loadConfig, 
  createProviders, 
  parseModelString,
  createAgentContext,
  runAgent,
  loadAllSkills 
} from 'agentflow-ts';

const config = await loadConfig();
const providers = createProviders(config.providers);
const { provider: providerName, model } = parseModelString('groq/llama-3.3-70b-versatile');
const provider = providers.get(providerName)!;

const skills = await loadAllSkills();
const context = createAgentContext(config, skills);

await runAgent('Design a CLI tool', context, {
  provider,
  model,
  maxTurns: 5,
});
```

## License

MIT
