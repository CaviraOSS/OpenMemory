# AI Rules

## Persistent Memory
- Read `docs/ai-context.md`, `docs/ai-rules.md`, and `docs/decisions.md` at the start of each task.
- Read and update `TODO.md` on every user prompt.
- Store reusable architecture, constraints, patterns, and decisions in these files.
- Treat these files as the source of truth instead of chat memory.

## Current Constraints
- Prioritize JavaScript-only implementation.
- Remove Python components from the main product path.
- Main near-term runtime target: package installable via npm or forkable from GitHub, with `npm run start` launching a server.
- Defer VS Code extension, dashboard rebuild, Python SDK compatibility, and non-core connectors until the JS server path is stable.
- Interpret "JS-only" as Node/TypeScript runtime and tooling unless explicitly changed to literal `.js` source only.
