# OpenMemory GraphRAG Bridge

Optional HTTP sidecar that lets the Node OpenMemory runtime use FalkorDB
GraphRAG-SDK without replacing the existing HSG/temporal memory path.

## Run locally

```bash
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt
set FALKORDB_HOST=127.0.0.1
set FALKORDB_PORT=6379
set OM_GRAPHRAG_BRIDGE_API_KEY=<shared-bridge-key>
set OM_GRAPHRAG_GRAPH_NAME=openmemory
set OM_GRAPHRAG_LLM_MODEL=<litellm-model>
set OM_GRAPHRAG_LLM_MAX_TOKENS=<optional-cap-for-local-ollama-step2>
set OM_GRAPHRAG_EMBEDDER_MODEL=<litellm-embedder-model>
set OM_GRAPHRAG_EMBEDDER_DIMENSIONS=<match-the-embedder-output-dimension>
set OLLAMA_API_BASE=http://127.0.0.1:11434
set OPENAI_API_KEY=...
.venv/Scripts/uvicorn server:app --host 127.0.0.1 --port 8765
```

Start FalkorDB separately:

```bash
docker run -d -p 127.0.0.1:6379:6379 -p 127.0.0.1:3001:3000 --name falkordb falkordb/falkordb:latest
```

## OpenMemory flags

```bash
OM_GRAPHRAG_ENABLED=true
OM_GRAPHRAG_URL=http://127.0.0.1:8765
OM_GRAPHRAG_BRIDGE_API_KEY=<shared-bridge-key>
OM_GRAPHRAG_WRITE_ENABLED=false
OM_GRAPHRAG_ALLOW_UNAUTH_WRITE=false
OM_GRAPHRAG_ALLOW_GLOBAL_QUERY=false
OM_GRAPHRAG_SYNC_ON_ADD=false
OM_GRAPHRAG_CONTEXT_ENABLED=false
OM_GRAPHRAG_EMBEDDER_DIMENSIONS=<match-the-embedder-output-dimension>
OM_GRAPHRAG_ENABLE_LEGACY_SCOPE_RECOVERY=false
```

Keep `OM_GRAPHRAG_WRITE_ENABLED=false` and `OM_GRAPHRAG_SYNC_ON_ADD=false`
until the source allowlist/redaction policy for writes is explicit. The bridge
does not default to an external LLM/embedder; choose model env vars deliberately.
When enabling writes through OpenMemory, prefer a non-empty `OM_API_KEY` over
`OM_GRAPHRAG_ALLOW_UNAUTH_WRITE=true`.
For local Ollama models, set `OLLAMA_API_BASE` and make the GraphRAG embedding
dimension match the model output. Example: `ollama/bge-m3:latest` uses `1024`.
If local Ollama verify/relationship extraction is too slow on cold starts, set
`OM_GRAPHRAG_LLM_MAX_TOKENS` to cap the bridge LLM completion path.
`OM_GRAPHRAG_GLINER_ALLOW_ONLINE_FALLBACK` is now an operator-only switch:
keep it `false` for deterministic cached startup and enable it only when you
explicitly want startup-time HF fallback on cache miss or cache-load failure.
`OM_GRAPHRAG_ALLOW_UNFILTERED_SCOPED_QUERY` is now a legacy compatibility flag
for stale graphs; ordinary scoped queries no longer require it after scope
metadata backfill.
`OM_GRAPHRAG_ENABLE_LEGACY_SCOPE_RECOVERY` is an operator-only recovery switch:
keep it `false` for a healthy backfilled graph and enable it only if you must
serve a stale corpus before running `/scope/backfill`.

`GET /health` reports the effective storage contract in
`scope_storage_contract`. It now also exposes
`scope_operator_recovery_path_present=true` to mark the dormant operator-only
recovery path. `scope_storage_compatibility_path_present` is kept as a
deprecated alias for older local consumers.

## Operator helpers

Run focused bridge logic tests inside the bridge dependency image:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\run-tests.ps1
```

Optionally rebuild the image first:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\run-tests.ps1 -RebuildImage
```

Run a hermetic FalkorDB + bridge end-to-end smoke on the host. By default this
uses a local fake Ollama-compatible stub so it does not depend on host Ollama
or live Hugging Face downloads:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\run-e2e.ps1
```

Optionally rebuild the image first:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\run-e2e.ps1 -RebuildImage
```

For an operator-realistic run against the host Ollama runtime instead of the
hermetic stub:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\run-e2e.ps1 -UseHostOllama
```

Backfill structured scope metadata onto older `Document`/`Chunk` nodes:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\backfill-scope.ps1 -DryRun
powershell -NoProfile -ExecutionPolicy Bypass -File .\backfill-scope.ps1
```

Target specific document ids when needed:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\backfill-scope.ps1 -DocumentIds doc-1,doc-2
```
