# Live Server Cleanup Design

## Goal
- Make the default JavaScript server path read like a human-maintained TypeScript backend while preserving current behavior.

## Scope
- Clean only files executed by the default JS server/package path.
- Keep memory add/query, user summary/memory routes, health/system routes, MCP registration, CLI commands, and package import behavior stable.
- Avoid broad architecture changes and avoid touching deferred dashboard, IDE, provider, Vercel, compression, dynamics, LangGraph, and temporal HTTP routes unless imported by the live path.

## Target Files
- `packages/openmemory-js/src/api/index.ts`
- `packages/openmemory-js/src/server.ts`
- `packages/openmemory-js/src/api/routes/index.ts`
- `packages/openmemory-js/src/api/routes/system.ts`
- `packages/openmemory-js/src/api/routes/memory.ts`
- `packages/openmemory-js/src/api/routes/users.ts`
- `packages/openmemory-js/src/api/middleware/auth.ts`
- `packages/openmemory-js/src/services/memoryService.ts`
- `packages/openmemory-js/src/database/connection.ts`
- `packages/openmemory-js/src/database/vector/postgres.ts`
- `packages/openmemory-js/src/retention/hsg.ts`
- `packages/openmemory-js/src/retention/embed.ts`
- `packages/openmemory-js/bin/opm.js`
- `packages/openmemory-js/tests/*`

## Design
- Normalize names in live files to conventional TypeScript backend style: `req`, `res`, `userId`, `projectId`, `memoryId`.
- Remove generated-looking comments, inflated labels, dead constants, unused helpers, and duplicated logic only when the behavior impact is clear.
- Keep `connection.ts` and `hsg.ts` mostly intact; improve local sections rather than splitting them in this pass.
- Tighten error handling in live add/query/delete/user paths so failures are not silently swallowed or reported as fake success.
- Keep tests minimal and targeted to touched behavior.

## Verification
- `npm run build`
- `npx tsx tests/import_smoke.ts`
- `npx tsx tests/omnibus.ts`
- `npx tsx tests/project_isolation.ts`
- live smoke: `/health`, `/retention/add`, `/retention/query`
- `rg` checks for generated naming/comment patterns in touched live files

## Risks
- `connection.ts` and `hsg.ts` are large and coupled; aggressive refactoring there is deferred.
- Existing tests share local SQLite compatibility state, so runtime tests should run sequentially.
