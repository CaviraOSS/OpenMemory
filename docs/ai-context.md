# AI Context

## Project
- OpenMemory repository.
- Current focus: architectural rewrite and code improvement.
- User priority: remove Python surfaces; make the project JavaScript-only for now.

## Current Goal
- Build durable recall and move `/v1/recall` off legacy HSG for Postgres.

## Architecture Inputs
- Target architecture from the attached architecture document: bitemporal, append-only cognitive graph with working memory, facets, provenance, contracts, contradictions, consolidation, three recall modes, explain API, and Postgres + pgvector first.
- FigJam board `cHvNZ1CU304RAH4ccuADBv`: input event -> working memory buffer -> ingestion pipeline -> durable cognitive graph -> executable edge runtime -> consolidation -> memory tiers -> recall engine -> explain API -> agent/app response.

## Repo Snapshot
- Active implementation package is `packages/openmemory-js`.
- Deferred surfaces were removed from the active tree during cleanup: secondary SDKs, old examples, ops tools, editor extension, dashboard shell, local DB/temp artifacts, and hosted deploy configs.
- Current default JS server surface is intentionally narrow: health/system, retention memory, users, and MCP when it builds cleanly.
- Initial `/v1` memory endpoints are registered. `/v1/memories` writes through the durable repository on Postgres and falls back to legacy HSG in SQLite compatibility mode.
- Current JS package still contains legacy internals that will be handled in later rewrite phases: custom `server.js`, SQLite/Postgres branches, sector-based HSG memory, waypoints, and route groups beyond the future `/v1` API.
