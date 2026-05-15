# Durable Ingestion Design

## Goal
- Define the durable ingestion boundary before moving `/retention/ingest` or `/retention/ingest/url` off legacy HSG.
- Keep ingestion replayable, auditable, and testable before adding automatic extraction.

## Current Rule
- `/retention/ingest` and `/retention/ingest/url` stay legacy compatibility routes.
- Durable `/v1` memory creation accepts structured memory input only.
- No automatic NLP extraction runs in the durable path yet.

## Target Flow
1. Accept an input event.
2. Persist the raw event in a working-memory buffer.
3. Extract candidate memory records, facets, entities, edges, provenance, and contracts.
4. Validate extracted candidates against tenant, project, privacy, and confidence rules.
5. Write durable memories transactionally.
6. Append versions and audit rows.
7. Return created memory IDs plus rejected candidates with reasons.

## Input Event Shape
```ts
type DurableIngestionEvent = {
  user_id: string;
  project_id?: string | null;
  source: {
    kind: "text" | "document" | "url" | "provider_event";
    uri?: string;
    id?: string;
    content_type?: string;
  };
  content: string | Buffer;
  metadata?: Record<string, unknown>;
  contracts?: Record<string, unknown>;
  observed_at?: string;
};
```

## Durable Tables Needed
- `working_memory_events`: raw event envelope, source, metadata, status, and audit correlation id.
- `extraction_candidates`: proposed memory content, facets, entities, edges, confidence, and rejection reason.
- Existing durable tables: `memories`, `memory_versions`, `entities`, `memory_entities`, `edges`, `provenance`, `audit_log`.

## Route Strategy
- Add durable route only after fixtures exist: `POST /v1/ingest`.
- Keep `/retention/ingest` and `/retention/ingest/url` unchanged until parity is proven.
- Do not create `/v1/ingest/url` unless URL ingestion needs route-specific behavior; prefer `source.kind = "url"`.

## Test Fixtures Before Implementation
- Plain text event produces one durable memory and audit row.
- HTML document fixture preserves title/body provenance.
- JSON document fixture stores original structure in metadata and extracted memory content separately.
- URL event fixture records URL provenance without requiring network in default tests.
- Invalid content type returns `400 invalid_request`.
- Tenant mismatch cannot read or recall another user's ingested memory.
- Failed extraction keeps the raw working-memory event with `failed` status and no durable memory writes.

## Explicitly Deferred
- Automatic consolidation from ingestion.
- Background scheduler.
- Provider webhooks.
- Dashboard ingestion UI.
- LLM-only extraction without deterministic fixtures.

