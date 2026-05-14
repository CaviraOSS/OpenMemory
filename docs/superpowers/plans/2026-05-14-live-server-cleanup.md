# Live Server Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the default JavaScript server path shorter, clearer, and more idiomatic while preserving current behavior.

**Architecture:** Keep the current package structure and narrow default server surface. Improve live files locally, avoiding broad splits of `connection.ts` or `hsg.ts` until the durable-core rewrite.

**Tech Stack:** Node.js 22, TypeScript, custom Express-like server wrapper, SQLite compatibility mode, Postgres/pgvector production direction, MCP SDK.

---

## File Map

- `packages/openmemory-js/src/api/index.ts`: server lifecycle, middleware, background jobs, route registration, startup logging.
- `packages/openmemory-js/src/api/middleware/auth.ts`: API key extraction, public-route allowlist, request auth logging.
- `packages/openmemory-js/src/api/routes/memory.ts`: live memory HTTP routes for add, ingest, query, update, list, get, delete.
- `packages/openmemory-js/src/api/routes/system.ts`: health and sector stats routes.
- `packages/openmemory-js/src/api/routes/users.ts`: live user summary and user memory routes.
- `packages/openmemory-js/src/services/memoryService.ts`: SDK-facing memory service wrapper over HSG and vector storage.
- `packages/openmemory-js/src/database/connection.ts`: current DB bootstrap/query registry; only local cleanup in this pass.
- `packages/openmemory-js/src/database/vector/postgres.ts`: vector-store implementation used by Postgres and SQLite compatibility.
- `packages/openmemory-js/src/retention/hsg.ts`: live memory add/query/update/delete logic; only targeted cleanup in this pass.
- `packages/openmemory-js/src/retention/embed.ts`: live embedding provider code; only remove obvious generated bloat if encountered.
- `packages/openmemory-js/bin/opm.js`: CLI against the live server routes.
- `packages/openmemory-js/tests/import_smoke.ts`: import side-effect smoke test.
- `packages/openmemory-js/tests/omnibus.ts`: core memory behavior test.
- `packages/openmemory-js/tests/project_isolation.ts`: project isolation test.

### Task 1: Baseline And Generated-Pattern Inventory

**Files:**
- Read: live files listed above
- Modify: none

- [ ] **Step 1: Run baseline build**

```powershell
npm run build
```

Expected from `packages/openmemory-js`: exit code `0`.

- [ ] **Step 2: Run baseline tests sequentially**

```powershell
npx tsx tests/import_smoke.ts
npx tsx tests/omnibus.ts
npx tsx tests/project_isolation.ts
```

Expected: all exit code `0`.

- [ ] **Step 3: Inventory generated-looking patterns in live files**

```powershell
rg -n 'production grade|incoming_http_request|outgoing_http_response|catch \(e\) \{\}|catch \(error\) \{\}|console\.log|as any|any\[\]|TODO|FIXME' src/api/index.ts src/api/middleware/auth.ts src/api/routes/memory.ts src/api/routes/system.ts src/api/routes/users.ts src/services/memoryService.ts src/database/connection.ts src/database/vector/postgres.ts src/retention/hsg.ts src/retention/embed.ts bin/opm.js
```

Expected: list of candidates to clean; no edits in this task.

### Task 2: Clean HTTP Route Naming And Error Shape

**Files:**
- Modify: `packages/openmemory-js/src/api/routes/memory.ts`
- Modify: `packages/openmemory-js/src/api/routes/users.ts`
- Modify: `packages/openmemory-js/src/api/routes/system.ts`

- [ ] **Step 1: Normalize handler locals**

Change local names only where behavior is unchanged:

```ts
const body = req.body as add_req;
const userId = body.user_id;
const projectId = body.project_id;
const limit = req.query.l ? parseInt(req.query.l) : 100;
const offset = req.query.u ? parseInt(req.query.u) : 0;
```

Expected: no exported API changes.

- [ ] **Step 2: Keep query failure explicit**

Ensure `/retention/query` continues returning:

```ts
res.status(500).json({ err: "query_failed", msg: e.message });
```

Expected: no silent empty result on query failure.

- [ ] **Step 3: Run route build check**

```powershell
npm run build
```

Expected: exit code `0`.

### Task 3: Clean Server Lifecycle And Middleware Noise

**Files:**
- Modify: `packages/openmemory-js/src/api/index.ts`
- Modify: `packages/openmemory-js/src/api/middleware/auth.ts`

- [ ] **Step 1: Remove unused comments and inflated startup wording**

Keep only useful startup logs:

```ts
console.log(`[SERVER] Starting on port ${env.port}`);
console.log(`[SERVER] Running on http://localhost:${env.port}`);
```

Expected: no behavior change.

- [ ] **Step 2: Keep public endpoint allowlist explicit**

Keep public health/MCP handling readable:

```ts
const PUBLIC_ENDPOINTS = new Set(["/health", "/sectors", "/mcp"]);
```

Expected: no dashboard public route.

- [ ] **Step 3: Verify import has no listener side effect**

```powershell
npx tsx tests/import_smoke.ts
```

Expected: `[IMPORT] package import did not start HTTP server`.

### Task 4: Clean Memory Service And Live HSG Hot Spots

**Files:**
- Modify: `packages/openmemory-js/src/services/memoryService.ts`
- Modify: `packages/openmemory-js/src/retention/hsg.ts`

- [ ] **Step 1: Remove unused helpers and dead locals**

Remove values that are assigned but never used in live code, such as local thresholds that do not affect branching.

Expected: TypeScript build still passes.

- [ ] **Step 2: Replace empty catches in live background paths with intentional no-op helpers**

Use a named helper where the operation is intentionally best-effort:

```ts
const ignore_background_error = () => undefined;
```

Then call:

```ts
on_query_hit(r.id, r.primary_sector, (text) =>
  embedForSector(text, r.primary_sector),
).catch(ignore_background_error);
```

Expected: no swallowed foreground add/query failures.

- [ ] **Step 3: Keep project isolation behavior unchanged**

Do not change this live query rule:

```ts
m.project_id === f.project_id ||
m.project_id === "system_global" ||
m.project_id === null
```

Expected: `project_isolation.ts` still passes.

### Task 5: Clean DB And Vector Store Locally

**Files:**
- Modify: `packages/openmemory-js/src/database/connection.ts`
- Modify: `packages/openmemory-js/src/database/vector/postgres.ts`

- [ ] **Step 1: Remove duplicate index creation**

Remove duplicated statements such as repeated `openmemory_stats_type_idx` or repeated SQLite temporal edge validity index.

Expected: schemas remain equivalent.

- [ ] **Step 2: Rename purely local variables where clarity improves**

Use local names that do not change exports:

```ts
const schema = process.env.OM_PG_SCHEMA || "public";
const memoryTable = `"${schema}"."${process.env.OM_PG_TABLE || "openmemory_memories"}"`;
```

Expected: exported `memories_table` still works.

- [ ] **Step 3: Run build**

```powershell
npm run build
```

Expected: exit code `0`.

### Task 6: Clean CLI Without Changing Commands

**Files:**
- Modify: `packages/openmemory-js/bin/opm.js`

- [ ] **Step 1: Keep command parsing small and predictable**

Keep the existing command surface, but avoid repeated command text parsing:

```js
const text = commandText();
if (!text) throw new Error('content required: opm add "text"');
await addmem(text, opts);
```

Expected: `opm add "multi word memory"` still sends full text.

- [ ] **Step 2: Syntax check CLI**

```powershell
node --check bin/opm.js
```

Expected: exit code `0`.

### Task 7: Final Verification

**Files:**
- Modify: none unless a verification failure has a traced root cause

- [ ] **Step 1: Run final build**

```powershell
npm run build
```

Expected: exit code `0`.

- [ ] **Step 2: Run tests sequentially**

```powershell
npx tsx tests/import_smoke.ts
npx tsx tests/omnibus.ts
npx tsx tests/project_isolation.ts
```

Expected: all exit code `0`.

- [ ] **Step 3: Run live server smoke**

Start `dist/server.js` on a temporary port with synthetic embeddings and request:

```text
GET /health
POST /retention/add
POST /retention/query
GET /dashboard/health
```

Expected: health ok, add returns an id, query returns at least one match, dashboard returns `404`.

- [ ] **Step 4: Run final generated-pattern scan**

```powershell
rg -n 'production grade|incoming_http_request|outgoing_http_response|catch \(e\) \{\}|catch \(error\) \{\}|TODO|FIXME' src/api/index.ts src/api/middleware/auth.ts src/api/routes/memory.ts src/api/routes/system.ts src/api/routes/users.ts src/services/memoryService.ts src/database/connection.ts src/database/vector/postgres.ts src/retention/hsg.ts src/retention/embed.ts bin/opm.js
```

Expected: no matches in touched live files unless intentionally documented.

- [ ] **Step 5: Review status**

```powershell
git status --short
```

Expected: existing `SDK/JS` deletion plus untracked `packages/` move remains visible; no unrelated files changed.

## Self-Review

- Spec coverage: all approved design targets are represented by tasks.
- Placeholder scan: no `TBD`, `TODO`, or undefined implementation steps remain.
- Type consistency: plan uses existing route names, test names, and file paths.
