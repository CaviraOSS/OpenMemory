# Durable Source Adapters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Notion, Google Drive, OneDrive, and bounded web crawler adapters to durable source ingestion.

**Architecture:** Adapters implement the existing `SourceConnector` interface and are registered through `getSourceConnector`. They only list/fetch source content; durable writes continue through `ingestSourceConnector` and `/v1/sources/:source/ingest`.

**Tech Stack:** TypeScript, Node `fetch`, optional dynamic imports, `node:test`, existing durable source framework.

---

### Task 1: Adapter Contract Tests

**Files:**
- Modify: `packages/openmemory-js/tests/architecture_parity.test.ts`

- [ ] Add failing tests for Notion, Google Drive, OneDrive, and crawler adapters using injected fake clients/fetchers.
- [ ] Add registry assertions for `notion`, `google_drive`, `google_sheets`, `google_slides`, `onedrive`, and `web_crawler`.
- [ ] Run `cd packages/openmemory-js && npx tsx --test tests/architecture_parity.test.ts`.

### Task 2: Notion Adapter

**Files:**
- Create: `packages/openmemory-js/src/sources/notion.ts`
- Modify: `packages/openmemory-js/src/sources/registry.ts`

- [ ] Implement `createNotionSource(config)` with injected `client` support.
- [ ] Support `database_id` query or page search.
- [ ] Fetch page title plus child blocks into markdown-like text.
- [ ] Run focused tests.

### Task 3: Google Drive Adapter

**Files:**
- Create: `packages/openmemory-js/src/sources/googleDrive.ts`
- Modify: `packages/openmemory-js/src/sources/registry.ts`

- [ ] Implement `createGoogleDriveSource(config)` with injected `service` support.
- [ ] Support Drive file listing and Google Docs/Sheets/Slides export.
- [ ] Map fetched content to `SourceContent`.
- [ ] Run focused tests.

### Task 4: OneDrive Adapter

**Files:**
- Create: `packages/openmemory-js/src/sources/onedrive.ts`
- Modify: `packages/openmemory-js/src/sources/registry.ts`

- [ ] Implement `createOneDriveSource(config)` with injected `fetcher` and optional `access_token`.
- [ ] Support listing and fetching Microsoft Graph drive items.
- [ ] Run focused tests.

### Task 5: Bounded Web Crawler

**Files:**
- Create: `packages/openmemory-js/src/sources/crawler.ts`
- Modify: `packages/openmemory-js/src/sources/registry.ts`

- [ ] Implement `createCrawlerSource(config)` with same-host URL discovery, `max_pages`, `max_depth`, timeout, and injected fetcher.
- [ ] Use existing HTML stripping instead of adding Cheerio.
- [ ] Run focused tests.

### Task 6: Docs And Verification

**Files:**
- Modify: `docs/ai-context.md`
- Modify: `docs/decisions.md`
- Modify: `TODO.md`

- [ ] Document active durable source adapters and optional dependency policy.
- [ ] Run `cd packages/openmemory-js && npm run format`.
- [ ] Run `npm test`.
- [ ] Run `npm --workspace openmemory-js run release-smoke`.
