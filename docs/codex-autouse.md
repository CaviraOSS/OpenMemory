# Codex IDE/CLI Autouse

OpenMemory can be used by Codex through three layers:

1. MCP tools via `~/.codex/config.toml`:
   `mcp_servers.openmemory.url = "http://localhost:8180/mcp"` plus
   `bearer_token_env_var = "OPENMEMORY_API_KEY"` when server auth is enabled.
2. IDE context provider via `~/.codex/context.json`:
   preferably through a local proxy such as
   `http://127.0.0.1:8181/api/ide/context`, so `context.json` does not need to
   carry a literal API key.
3. Codex hooks via `~/.codex/hooks/openmemory-active-bridge.js`.

The hook bridge is bounded and fail-open. It checks `/health`, emits
SessionStart `additionalContext` when OpenMemory is up, tries one bounded
`/api/ide/context` recall for the current project, falls back to recent
project memories through the local MCP surface when semantic recall is empty,
and stores only small redacted/truncated session or prompt events through
`/api/ide/events`.

## Safety Defaults

- High-confidence token-like strings are redacted before storage.
- Prompt excerpts are capped by `OPENMEMORY_HOOK_MAX_CONTENT` (`900` by
  default).
- The hook uses `OPENMEMORY_API_KEY` or `OM_API_KEY` when present, and falls
  back to `~/.codex/openmemory-api-key.txt` for local no-restart operation.
- A small local context proxy can read the same key file and inject `x-api-key`
  for IDE context calls, removing the plaintext secret from `context.json`.
- Any timeout or OpenMemory failure exits `0` and does not block Codex.
- GraphRAG writes remain controlled separately by `OM_GRAPHRAG_WRITE_ENABLED`
  and the authenticated write gate.

## Smoke

```powershell
node --check C:/Users/Михаило/.codex/hooks/openmemory-active-bridge.js
Invoke-RestMethod -Uri http://127.0.0.1:8180/health -TimeoutSec 5
```

Manual redaction smoke:

```powershell
$payload = '{"session_id":"codex-hook-smoke","cwd":"D:/BooksDocs/Project Astra","prompt":"Smoke sk-REDACTED-EXAMPLE"}'
$payload | node C:/Users/Михаило/.codex/hooks/openmemory-active-bridge.js prompt
```

Then query:

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:8181/api/ide/context `
  -Method Post `
  -ContentType 'application/json' `
  -Body '{"query":"OpenMemory hook redacted excerpt","project_id":"D:/BooksDocs/Project Astra","user_id":"codex","k":5}'
```
