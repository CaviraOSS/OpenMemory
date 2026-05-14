# Decisions

## 2026-05-13
- Initialize persistent AI memory files because they were missing.
- Near-term rewrite direction: JavaScript-only server-first package; defer VS Code and adjacent integrations.
- Use `packages/openmemory-js` as the canonical product package for the rewrite.
- Prefer a strangler rewrite: build a clean durable core inside the JS package while temporarily adapting legacy endpoints.
- Production storage target is Postgres + pgvector first; SQLite local mode is deferred.
- Public API should stay small: remember, recall, explain, consolidate, resolve contradiction.
- Aggressive cleanup removes deferred product surfaces from the active tree instead of parking them.
- Cleanup pass may edit docs/config/workflows/package metadata, but should avoid changing JS implementation logic until the setup task is complete.

## 2026-05-14
- JS package startup contract: `npm run dev` runs `src/server.ts`, `npm run build` emits `dist`, and `npm run start` runs `dist/server.js`.
- Importing `openmemory-js` must not start an HTTP server; server startup is explicit through `startServer()`.
- Default server route set is limited to health/system, retention memory, users, and MCP; dashboard, IDE, Vercel, connector webhooks, compression, dynamics, LangGraph, and temporal HTTP routes are deferred.
- Root env and compose defaults are Postgres + pgvector first; SQLite remains legacy/local compatibility, not the advertised production path.
- Live server cleanup should improve only the default runtime path first; broad splits of `connection.ts` and `hsg.ts` wait for the durable-core rewrite.
- `TODO.md` is part of the persistent workflow and must be updated on every user prompt.
- Rewrite Phase 0 root npm workflow is active: root scripts delegate to the `openmemory-js` workspace for dev, build, start, test, and migrate.
