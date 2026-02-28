# Contributing to AgentFlow

First off, thanks for considering contributing! AgentFlow is open source and we welcome contributions from everyone.

## Ways to Contribute

### 🐛 Report Bugs

Found a bug? [Open an issue](https://github.com/agentflow/agentflow/issues/new?template=bug_report.md) with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Your environment (OS, Go version, model provider)

### 💡 Suggest Features

Have an idea? [Open an issue](https://github.com/agentflow/agentflow/issues/new?template=feature_request.md) with:
- The problem you're trying to solve
- Your proposed solution
- Alternatives you've considered

### 📚 Improve Documentation

Docs can always be better. Fix typos, add examples, clarify confusing sections.

### 🔧 Submit Code

Ready to code? Here's how:

## Development Setup

```bash
# Clone the repo
git clone https://github.com/agentflow/agentflow.git
cd agentflow

# Install dependencies
go mod download

# Run tests
go test ./...

# Build
go build -o agentflow ./cmd/agentflow
```

## Making Changes

### 1. Fork and Branch

```bash
# Fork on GitHub, then:
git clone https://github.com/YOUR_USERNAME/agentflow.git
cd agentflow
git checkout -b feature/your-feature-name
```

### 2. Write Code

- Follow existing code style
- Add tests for new functionality
- Update docs if needed

### 3. Test

```bash
# Run all tests
go test ./...

# Run with race detector
go test -race ./...

# Run linter
golangci-lint run
```

### 4. Commit

Use conventional commits:
```
feat: add new provider for X
fix: handle edge case in skill matching
docs: clarify config options
test: add tests for subagent pool
refactor: simplify provider interface
```

### 5. Pull Request

- Push your branch
- Open a PR against `main`
- Fill out the PR template
- Wait for review

## Code Style

### Go

- Run `gofmt` before committing
- Follow [Effective Go](https://golang.org/doc/effective_go)
- Use meaningful variable names
- Add comments for exported functions

### Tests

- Table-driven tests preferred
- Test edge cases
- Mock external services
- Aim for >80% coverage on new code

### Documentation

- Update README if adding features
- Add godoc comments to exported functions
- Keep docs/guides/ current

## Adding a New Provider

Providers live in `internal/provider/`. To add one:

1. Create `internal/provider/yourprovider.go`
2. Implement the `Provider` interface:

```go
type Provider interface {
    Chat(ctx context.Context, messages []Message, opts Options) (string, error)
    Stream(ctx context.Context, messages []Message, opts Options) (<-chan string, error)
    Models() ([]string, error)
}
```

3. Add tests in `internal/provider/yourprovider_test.go`
4. Register in `internal/provider/registry.go`
5. Document in README and config docs

## Adding a New Skill

Skills live in `skills/`. To add one:

1. Create `skills/your-skill/SKILL.md`:

```markdown
---
name: your-skill
description: "When to use this skill"
triggers:
  - "keyword1"
  - "keyword2"
priority: 50
---

# Your Skill

## Overview
...

## Process
...

## Checklist
...
```

2. Test it manually with `agentflow skill run your-skill`
3. Add integration tests if complex
4. Document in skill guide

## Review Process

1. Maintainer reviews within 48 hours
2. Address feedback
3. Maintainer approves and merges
4. Your contribution is in the next release!

## Community

- [Discord](https://discord.gg/agentflow) — Chat with other contributors
- [GitHub Discussions](https://github.com/agentflow/agentflow/discussions) — Longer-form discussions
- [Twitter](https://twitter.com/agentflow_dev) — Updates and news

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Questions?

Open an issue or ask on Discord. We're happy to help!
