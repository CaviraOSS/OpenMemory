# MCP

MCP support is active as an explicit stdio adapter over durable unprefixed api behavior.
It does not start with the default HTTP server and does not revive the old
`insp/openmemory-js/src/ai/mcp.ts` module or the removed `/retention/*` runtime.

## Usage

Run after building the package:

```bash
npm run build
opm mcp
```

The adapter calls `OPENMEMORY_URL` or `http://localhost:8080` by default. Use
`OPENMEMORY_API_KEY` or `OM_API_KEY` for protected servers.

## Goals

- Keep `npm run start` focused on the HTTP API: `/health` and durable unprefixed routes.
- Keep MCP only as an explicit command or opt-in transport.
- Map every MCP operation to the durable lifecycle API: create, recall, get,
  list, update, delete, explain, candidate accept/reject, and later graph tools.
- Preserve tenant and project isolation on every tool call.
- Keep STDIO stdout protocol-clean: JSON-RPC only, no logs, banners, telemetry,
  or database startup messages.

## Tool Contract

Use schema-stable tool names without dots:

- `openmemory_store`: create durable memory through `/memories`.
- `openmemory_search`: recall through `/recall`.
- `openmemory_get`: get one memory through `/memories/:id`.
- `openmemory_list`: list current memories through `/memories`.
- `openmemory_update`: patch durable memory through `/memories/:id`.
- `openmemory_delete`: soft-delete through `/memories/:id`.
- `openmemory_explain`: explain through `/memories/:id/explain`.
- `openmemory_ingest`: create a durable source event through `/ingest`.

Do not expose temporal, connector, dashboard, or compression tools until those
features exist as durable unprefixed api contracts with tests.

## Transport Plan

- STDIO: first transport to rebuild because it is the most fragile.
- HTTP/SSE or streamable HTTP: add only after STDIO passes protocol tests.
- Per-request transport/server state: required for current MCP SDK behavior;
  do not reuse one global transport across concurrent clients.
- Logging: route all diagnostics to stderr or an injected logger. Package import,
  SDK import, and STDIO startup must not write to stdout.

## Scope Rules

- `user_id` and `project_id` are explicit tool arguments.
- If client metadata or headers later provide scope, normalize it once before
  calling durable repositories.
- Missing `user_id` keeps current durable defaults; tenant mismatch must still
  hide memory existence as `404 not_found`.
- Project-scoped recall keeps current global visibility: exact `project_id`
  plus `project_id is null` rows.

## Validation Rules

- Use the installed MCP SDK schema format directly. Do not hand-roll a JSON
  schema dialect that strict clients reject.
- Tool input schemas should mirror unprefixed durable api validation:
  - required non-empty strings for content, query, ids, and reasons
  - bounded numbers for limits, boosts, confidence, and offsets
  - closed enums for recall mode, tier, and executable edge types
  - object-only metadata, facets, contracts, source, and scope fields
- Every tool result should return the same normalized durable payload shape as
  unprefixed durable api, with no MCP-only response schema unless the protocol requires wrapping.

## Test Coverage

- Importing the package and MCP module does not start a server or write stdout.
- Tool names are schema-stable and use underscore naming.
- Tool registration maps to durable HTTP routes only.

Future protocol tests should cover STDIO stdout cleanliness, concurrent
transport isolation, and full durable DB tool behavior with real Postgres.

## Explicit Non-Goals

- No old SQLite, Valkey, HSG, retention, or legacy MCP module revival.
- No dashboard or editor setup in this tranche.
- No connector-specific MCP tools until connector ingestion is rebuilt as
  durable source events and extraction candidates.
- No background server side effects from MCP imports.
