# FalkorDB GraphRAG Integration

OpenMemory keeps its existing HSG and temporal memory systems as the primary
runtime. FalkorDB GraphRAG is an optional sidecar for relationship-heavy,
multi-hop retrieval.

## Architecture

```text
Codex IDE / Codex CLI
        |
        v
OpenMemory Node runtime
  - /memory/add
  - /api/ide/context
  - /mcp tools
        |
        | optional HTTP bridge, env-gated
        v
tools/openmemory-graphrag-bridge
        |
        v
FalkorDB + graphrag-sdk
```

The bridge is disabled by default. Normal OpenMemory startup, MCP, and IDE
context retrieval must work even when FalkorDB and `graphrag-sdk` are absent.

## Enable

1. Start FalkorDB and the bridge:

```bash
docker compose --profile graphrag up -d falkordb graphrag-bridge
```

2. Enable OpenMemory integration:

```bash
OM_GRAPHRAG_ENABLED=true
OM_GRAPHRAG_URL=http://127.0.0.1:8765
OM_GRAPHRAG_BRIDGE_API_KEY=<shared-bridge-key>
OM_GRAPHRAG_TIMEOUT_MS=120000
OM_GRAPHRAG_LLM_MODEL=<litellm-model>
OM_GRAPHRAG_LLM_MAX_TOKENS=<optional-cap-for-local-ollama-step2>
OM_GRAPHRAG_EMBEDDER_MODEL=<litellm-embedder-model>
OM_GRAPHRAG_EMBEDDER_DIMENSIONS=<match-the-embedder-output-dimension>
```

The bridge does not choose an external LLM or embedder by default. Set these
models explicitly, preferably to a local provider when syncing private memory.
For local Ollama models in Docker, also set `OLLAMA_API_BASE=http://host.docker.internal:11434`.
Example: `ollama/bge-m3:latest` needs `OM_GRAPHRAG_EMBEDDER_DIMENSIONS=1024`.
If local Ollama verify/relationship extraction is too slow on cold starts,
use `OM_GRAPHRAG_LLM_MAX_TOKENS` as a guardrail for the bridge LLM completion
path.
For local Ollama-backed ingest/query, raise `OM_GRAPHRAG_TIMEOUT_MS`; `120000`
is a practical starting point for cold caches and first-time extraction.
The bridge can also persist Hugging Face / GLiNER artifacts across container
recreates through `HF_HOME`, `TRANSFORMERS_CACHE`, and the
`graphrag_bridge_hf_cache` volume, with optional background prewarm via
`OM_GRAPHRAG_GLINER_PREWARM=true`.
Keep `OM_GRAPHRAG_GLINER_ALLOW_ONLINE_FALLBACK=false` for deterministic cached
startup; enable it only when you intentionally want startup-time HF fallback on
cache miss or cached-model load failure.

3. Optional writes, auto-sync, and IDE context:

```bash
OM_GRAPHRAG_WRITE_ENABLED=true
OM_API_KEY=<non-empty-api-key>
OM_GRAPHRAG_SYNC_ON_ADD=true
OM_GRAPHRAG_CONTEXT_ENABLED=true
```

Use writes and auto-sync only after redaction and source allowlist policy is
explicit. If `OM_API_KEY` is empty, GraphRAG writes stay blocked unless
`OM_GRAPHRAG_ALLOW_UNAUTH_WRITE=true` is set deliberately for a strictly
loopback/firewalled deployment.

Scoped IDE/MCP GraphRAG queries are enforced server-side in the bridge. When
`user_id` and/or `project_id` are supplied, the bridge filters retrieved source
passages by structured `openmemory_*` properties stamped onto `Document` and
`Chunk` nodes inside FalkorDB before answer generation and fails closed if no
scope-matching context remains. Pre-existing graph content without those
properties falls back to the older provenance-text check until it is re-synced.
The bridge also exposes `POST /scope/backfill` for operator-driven backfill of
older graph content from the already-ingested provenance text.
For local operator use on Windows/PowerShell, the bridge tool directory ships
`backfill-scope.ps1`, `run-tests.ps1`, and `run-e2e.ps1`.
`run-e2e.ps1` now defaults to a hermetic bridge smoke with a local fake
Ollama-compatible stub so the test can run without host Ollama or live HF
downloads; use `-UseHostOllama` only when you intentionally want the
operator-realistic path.
`OM_GRAPHRAG_ENABLE_LEGACY_SCOPE_RECOVERY=true` is now an operator-only escape
 hatch for stale corpora; normal scoped queries should run with it disabled
 once scope metadata backfill has been completed.

`OM_GRAPHRAG_ALLOW_UNFILTERED_SCOPED_QUERY` is now a legacy compatibility flag
and is no longer required for ordinary scoped queries.

Bridge `/health` reports the **effective** storage contract in
`scope_storage_contract`. It now also exposes
`scope_operator_recovery_path_present=true` to signal that dormant
operator-only stale-corpus recovery code still exists.
`scope_storage_compatibility_path_present` remains as a deprecated alias for
older local consumers.

Unscoped/global GraphRAG queries are also disabled by default. Set
`OM_GRAPHRAG_ALLOW_GLOBAL_QUERY=true` only when global graph retrieval is an
explicit policy decision.

Direct bridge access requires `OM_GRAPHRAG_BRIDGE_API_KEY`; the Node runtime
sends it as `x-graph-api-key`.

The current mirror uses GraphRAG SDK incremental document APIs:
`update(..., if_missing="ingest")` for upserts and `delete_document(...)` for
deletes. `finalize()` remains caller-controlled because its cost scales with
graph size; do not enable per-write finalization unless you have measured the
trade-off.

## API

- `GET /graphrag/status` checks bridge reachability.
- `POST /graphrag/sync` syncs either an existing OpenMemory memory id or
  explicit `{ document_id, content }`; it requires `OM_GRAPHRAG_WRITE_ENABLED=true`.
- `POST /graphrag/delete` removes one GraphRAG document by `document_id` or
  OpenMemory memory id.
- `POST /graphrag/query` queries GraphRAG and returns the raw bridge payload.
  Its `k` field is mapped to the GraphRAG SDK retrieval caps used by the
  bridge strategy.

## MCP Tools

- `openmemory_graphrag_status`
- `openmemory_graphrag_sync`
- `openmemory_graphrag_delete`
- `openmemory_graphrag_query`

These tools are supplemental. Use `openmemory_query` first for ordinary
personal/project memory lookup, and use GraphRAG for questions where graph
relationships matter.
