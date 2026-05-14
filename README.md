# OpenMemory

OpenMemory is being cleaned up into a JavaScript/Node-first durable memory server.

The active product path is currently:

- `packages/openmemory-js`
- Node/TypeScript server runtime
- Postgres + pgvector as the production storage target
- npm-based development and release workflow

Deferred surfaces such as editor extensions, dashboard UI, secondary SDKs, old examples, and hosted deploy templates have been removed from the active tree for now.

## Current Setup

```bash
cd packages/openmemory-js
npm install
npm run build
npm run start
```

The default server port is `8080`.

## Development

```bash
cd packages/openmemory-js
npm run dev
npm run build
npx tsx tests/omnibus.ts
```

The default server registers only the core JS API: `/health`, `/sectors`,
`/retention/*`, `/users/*`, and MCP. Dashboard, IDE, hosted deploy, and
connector webhook surfaces are deferred.

## Documentation

- Rewrite plan: `docs/architecture-rewrite-plan.md`
- Persistent AI context: `docs/ai-context.md`, `docs/ai-rules.md`, `docs/decisions.md`
- Package docs: `packages/openmemory-js/README.md`

## Status

This repository is in an architectural cleanup phase. Keep new work focused on the JS package and server path until the durable core rewrite is complete.
