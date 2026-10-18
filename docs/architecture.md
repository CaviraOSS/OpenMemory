<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : docs/architecture.md
 usage : documents LongMemory architecture
-->

# LongMemory Hydrograph architecture

LongMemory ships as one TypeScript npm package named `longmemory`. There is no
separate SDK package — the package itself is the SDK, usable as a library, a
CLI, or a self-hosted HTTP/MCP server. See [`ARCHITECTURE.md`](../ARCHITECTURE.md)
at the repository root for the high-level diagram and core invariants; this
page indexes the detailed subsystem documents.

## Entry surfaces

- `src/index.ts` — public library API (`createMemory`, types).
- `src/cli` — the `longmemory` binary and interactive session porter.
- `src/server` — the self-hosted HTTP API (`/v1/*`) and Streamable HTTP MCP endpoint.
- `src/mcp` — governed MCP tools, resources, prompts, and transports.
- `dashboard` — a Next.js operational UI that proxies to the HTTP API.
- `apps/vscode-extension` — a VS Code client over the CLI's stable JSON output.
- `integrations` — host-native plugins, MCP configs, and framework examples.

Every surface calls the same `createMemory` engine instance; none construct a
separate recall or storage path.

## Ingest to recall pipeline

1. **Ingest** ([`docs/ingest.md`](ingest.md)) parses an event, hashes an
   immutable [content-addressed node](immutability.md), executes
   [typed edges](edges.md), and resolves [entities](entities.md).
2. **Storage** ([`docs/sqlite.md`](sqlite.md)) persists nodes, edges, and
   lifecycle state keyed by `(tenant_id, user_id, node_id)`; an in-memory store
   is available for embedded/library use.
3. **Recall** runs through one of four explicit modes, never a single flat
   vector search: [strict](strict-recall.md), [historical](historical-recall.md),
   [associative](associative-recall.md), and [world-grounded](world-grounded-recall.md).
   [Multilingual recall](multilingual.md) runs across all four.
4. **Context assembly** bounds the result by token budget and provenance
   before it reaches a caller.

## Lifecycle

Memory content and provenance are immutable once written; mutable lifecycle
state (status, salience, activation) evolves through
[contracts](contracts.md), [grounding](grounding.md),
[consolidation](consolidation.md), [reconsolidation](reconsolidation.md), and
[compression](compression.md) — see [`docs/temporal.md`](temporal.md) and
[`docs/invariants.md`](invariants.md) for the rules every stage must hold.

## Agents and governance

[Project memory](project-memory.md) gives coding/workflow agents durable,
governed context; [`docs/worlds.md`](worlds.md) and
[`docs/formulas.md`](formulas.md) cover scoping and scoring.
[`docs/mcp.md`](mcp.md) and [`docs/api.md`](api.md) document the MCP and REST
surfaces; [`docs/embeddings.md`](embeddings.md) documents the embedding
provider stack; [`docs/connectors.md`](connectors.md) documents ingestion
connectors; [`docs/migration.md`](migration.md) documents migrating from a
legacy store.

## Shared engine rule

The HTTP server, CLI, and MCP transports must all call `createMemory`. They
must not construct separate engine paths.
