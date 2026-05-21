# Durable MCP Ingestion Sources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add MCP, multi-format ingestion, and source ingestion through durable `/v1` boundaries without reviving removed legacy surfaces.

**Architecture:** MCP is an opt-in stdio adapter over durable HTTP routes. Document and source ingestion create working-memory events and extraction candidates through existing durable repository functions. Source adapters are small, dependency-light modules behind a registry.

**Tech Stack:** TypeScript, Node HTTP adapter, Postgres durable repositories, `node:test`, optional MCP SDK dependency.

---

### Task 1: Contract Tests

**Files:**
- Modify: `packages/openmemory-js/tests/architecture_parity.test.ts`

- [ ] Add tests for `extractDocumentContent`, `extractUrlContent`, source connector ingestion with a fake connector, MCP module import safety, and new route registration.
- [ ] Run `cd packages/openmemory-js && npx tsx --test tests/architecture_parity.test.ts` and confirm the new route/MCP assertions fail before implementation.

### Task 2: Document Ingestion Route

**Files:**
- Modify: `packages/openmemory-js/src/api/routes/v1.ts`
- Modify: `packages/openmemory-js/src/ingestion/extract.ts`

- [ ] Add `POST /v1/ingest/document`.
- [ ] Validate `content_type`, `data` or `url`, optional `encoding`, `source`, `metadata`, `contracts`, `user_id`, and `project_id`.
- [ ] Extract content, create a durable working-memory event, create an extraction candidate, and return `{ ok, event, candidate }`.
- [ ] Return `422 extractor_unavailable` for unsupported formats.
- [ ] Run focused tests.

### Task 3: Source Registry And Built-In Adapters

**Files:**
- Create: `packages/openmemory-js/src/sources/registry.ts`
- Create: `packages/openmemory-js/src/sources/web.ts`
- Create: `packages/openmemory-js/src/sources/github.ts`
- Modify: `packages/openmemory-js/src/sources/framework.ts`
- Modify: `packages/openmemory-js/src/api/routes/v1.ts`

- [ ] Add a source registry with `web` and `github`.
- [ ] Add `POST /v1/sources/:source/ingest`.
- [ ] Web source ingests one URL or a bounded list of URLs through existing URL extraction.
- [ ] GitHub source fetches repo files/issues via GitHub REST using optional token and bounded limits.
- [ ] Source ingestion must create events and candidates, not memories.
- [ ] Run focused tests.

### Task 4: MCP Stdio Adapter

**Files:**
- Create: `packages/openmemory-js/src/mcp/client.ts`
- Create: `packages/openmemory-js/src/mcp/server.ts`
- Modify: `packages/openmemory-js/bin/opm.js`
- Modify: `packages/openmemory-js/package.json`

- [ ] Add MCP SDK dependency.
- [ ] Add durable HTTP client functions for store/search/get/list/update/delete/explain/ingest.
- [ ] Add MCP tool definitions with underscore names from `docs/mcp.md`.
- [ ] Add `opm mcp` command that starts stdio MCP only when invoked.
- [ ] Ensure imports do not write stdout or start HTTP server.
- [ ] Run focused tests and build.

### Task 5: Docs And Persistent Memory

**Files:**
- Modify: `docs/mcp.md`
- Modify: `docs/ai-context.md`
- Modify: `docs/decisions.md`
- Modify: `TODO.md`

- [ ] Document the active MCP command, supported ingestion formats, and built-in source adapters.
- [ ] Move completed tranche items from `TODO.md` active to done.
- [ ] Run `npm test` from repo root.
