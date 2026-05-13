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
