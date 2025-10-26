# Integrating OpenMemory with AI Coding Environments

This directory holds lightweight SDK shims that let popular AI-assisted IDEs talk to your OpenMemory server without additional backend plumbing. Every integration exposes the same small surface:

| Function | Description |
|----------|-------------|
| `remember(content, tags?)` | Persists a memory via `POST /memory/add`. |
| `recall(query)` | Retrieves related memories via `POST /memory/query`. |
| `forget(id)` | Removes a memory via `DELETE /memory/{id}`. |

All clients auto-detect `OPENMEMORY_URL` from the environment (`process.env.OPENMEMORY_URL`), falling back to `http://localhost:8080` so you can plug them into existing workflows instantly.

## Quick Example

```ts
import { remember, recall } from './IDE/claude/claude'

await remember('User prefers dark mode.', ['preferences'])
const theme = await recall('What theme does user like?')
```

## Supported IDEs

- **Claude Code (Anthropic)** — `/IDE/claude/claude.ts`
- **GitHub Copilot / Codex** — `/IDE/codex/codex.js`
- **Cursor IDE** — `/IDE/cursor/cursor.ts`
- **Windsurf** — `/IDE/windsurf/windsurf.ts`

Each subdirectory contains:

- The minimal client file (`claude.ts`, `codex.js`, `cursor.ts`, `windsurf.ts`).
- A dedicated README with installation instructions, environment configuration, and usage snippets tailored to that IDE.

Use these clients as-is or adapt them to your project’s structure—they’re intentionally dependency-free and ESM-friendly so that IDE agents (Claude, Copilot, Cursor, Windsurf) can introspect and start storing context instantly.
