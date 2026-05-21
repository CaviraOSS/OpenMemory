# Runtime Value Insp Ports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port durable-compatible runtime features from `insp/openmemory-js` without reviving old storage, routes, or background jobs.

**Architecture:** Add small deterministic utilities and adapters that feed durable `/v1` contracts. Source and extraction code must create working-memory events and extraction candidates, while compression and chunking remain pure helpers until durable jobs use them.

**Tech Stack:** Node.js, TypeScript, current `packages/openmemory-js` package, durable Postgres repository tests with `node:test`.

---

### Task 1: Chunking Utility

**Files:**
- Create: `packages/openmemory-js/src/ingestion/chunking.ts`
- Modify: `packages/openmemory-js/tests/architecture_parity.test.ts`

- [x] **Step 1: Write tests for paragraph-preserving chunks**

Add assertions that long text splits into ordered chunks without losing content and that short text stays a single chunk.

- [x] **Step 2: Implement `chunkTextForCandidates`**

Create a pure utility that preserves exact text order, prefers paragraph boundaries, adds chunk indexes, and does not write storage.

- [x] **Step 3: Verify focused tests**

Run `cd packages/openmemory-js && npx tsx --test tests/architecture_parity.test.ts`.

### Task 2: Compression Preview

**Files:**
- Create: `packages/openmemory-js/src/ingestion/compression.ts`
- Modify: `packages/openmemory-js/tests/architecture_parity.test.ts`

- [x] **Step 1: Write tests for deterministic preview**

Assert compression removes boilerplate, keeps important terms, reports metrics, and does not mutate durable memory.

- [x] **Step 2: Implement `previewMemoryCompression`**

Port only deterministic text normalization and scoring ideas from old `ops/compress.ts`; do not add routes or DB writes.

- [x] **Step 3: Verify focused tests**

Run `cd packages/openmemory-js && npx tsx --test tests/architecture_parity.test.ts`.

### Task 3: URL Extraction

**Files:**
- Modify: `packages/openmemory-js/src/ingestion/extract.ts`
- Modify: `packages/openmemory-js/tests/architecture_parity.test.ts`

- [x] **Step 1: Write tests for injected URL fetch**

Assert URL extraction uses an injected fetcher, strips HTML, preserves source URL metadata, and rejects failed HTTP responses.

- [x] **Step 2: Implement `extractUrlContent`**

Add a small fetch adapter that returns extracted content for candidate creation without adding dependencies.

- [x] **Step 3: Verify focused tests**

Run `cd packages/openmemory-js && npx tsx --test tests/architecture_parity.test.ts`.

### Task 4: Source Rate Limiter

**Files:**
- Modify: `packages/openmemory-js/src/sources/framework.ts`
- Modify: `packages/openmemory-js/tests/architecture_parity.test.ts`

- [x] **Step 1: Write tests for rate limiter scheduling**

Assert first token is immediate and exhausted tokens wait according to requests per second.

- [x] **Step 2: Implement `SourceRateLimiter`**

Adapt the old token bucket behavior with injected clock/sleep for deterministic tests.

- [x] **Step 3: Verify focused tests**

Run `cd packages/openmemory-js && npx tsx --test tests/architecture_parity.test.ts`.

### Task 5: Docs and Full Verification

**Files:**
- Modify: `TODO.md`
- Modify: `docs/ai-context.md`
- Modify: `docs/decisions.md`
- Modify: `docs/insp-openmemory-js-forensic-audit.md`

- [x] **Step 1: Record ports and rejected surfaces**

Update persistent memory files with the specific old features ported and the surfaces still rejected.

- [x] **Step 2: Format and test**

Run `cd packages/openmemory-js && npm run format`, `cd packages/openmemory-js && npm test`, and root `npm test`.
