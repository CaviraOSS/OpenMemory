# OpenMemory Improvement Implementation Plan

> **Purpose**: Convert the feature/improvement ideas already captured in this repository into a concrete, execution-ready plan tied to the current codebase.
>
> **Date**: 2026-02-13

---

## 1) Current Codebase Baseline (Repository Analysis)

### 1.1 Primary implementation surfaces

- **Node/TS engine + API**: `packages/openmemory-js/src/`
  - Routes: `server/routes/*.ts`
  - Memory core: `memory/hsg.ts`
  - DB schema/init: `core/db.ts`
  - Auth/rate limiting: `server/middleware/auth.ts`
  - Ingestion + extraction + compression: `ops/*.ts`
  - Temporal graph: `temporal_graph/*.ts`
- **Python SDK + server**: `packages/openmemory-py/src/openmemory/`
  - Mirror memory implementation (`memory/`, `ops/`, `core/`, `server/routes/`)
- **Dashboard (Next.js)**: `dashboard/`

### 1.2 Existing capabilities relevant to improvement scope

- HSG sectors currently configured in TS/Python (episodic, semantic, procedural, emotional, reflective)
- Memory CRUD + query already available under `/memory/*`
- Temporal fact graph exists (`temporal_facts`, `temporal_edges` in Node DB init)
- Source ingestion + GitHub webhook route exists (`server/routes/sources.ts`)
- Version field already exists on memory rows (`version integer default 1`)

### 1.3 Build/Test Validation Baseline

- `packages/openmemory-js`: `npm run build` currently fails in this environment due to missing module/type resolution
- `packages/openmemory-py`: `pytest` unavailable in current environment (`No module named pytest`)
- `dashboard`: `npm run lint` fails in this environment (`eslint: not found`)

These are environment/dependency setup issues, not changes introduced by this improvement planning update.

---

## 2) Planning Principles

1. **Small, vertical slices** over broad rewrites.
2. **Schema-safe migrations** (additive first, no destructive migration in first pass).
3. **Feature parity discipline** between Node and Python APIs where feasible.
4. **Security and observability gates** before broad rollout.
5. **Document-heavy features must remain optional/configurable** to avoid changing baseline memory behavior for existing users.

---

## 3) Workstream A — Security Hardening

## A1. Authentication behavior when `OM_API_KEY` is unset
- **Current touchpoint**: `packages/openmemory-js/src/server/middleware/auth.ts`
- **Plan**:
  - Add explicit `OM_REQUIRE_AUTH=true|false` gate.
  - Default to backward-compatible behavior; enable strict mode for production.
- **Deliverables**:
  - Config parsing update
  - Auth middleware branch for strict mode
  - README + `.env.example` documentation
- **Acceptance criteria**:
  - Strict mode returns 503/401 when key missing.
  - Non-strict mode preserves current behavior with warning logs.

## A2. CORS hardening
- **Current touchpoint**: `packages/openmemory-js/src/server/index.ts` (`Access-Control-Allow-Origin: *`)
- **Plan**:
  - Add `OM_CORS_ALLOWED_ORIGINS` env-based allowlist.
  - Keep wildcard fallback only when allowlist not configured.
- **Acceptance criteria**:
  - Requests with disallowed origin do not receive permissive CORS headers.

## A3. Rate-limit store memory growth
- **Current touchpoint**: `server/middleware/auth.ts` in-memory `Map`
- **Plan**:
  - Introduce max-entry cap + oldest-entry eviction (minimal change).
  - Add optional Redis/Valkey-backed limiter as later enhancement.
- **Acceptance criteria**:
  - Store size remains bounded under high-IP churn simulation.

## A4. Error response consistency
- **Current touchpoints**: route handlers under `server/routes/*.ts`
- **Plan**:
  - Standardize generic client error codes; keep detailed logs server-side.
  - Sweep source/webhook routes for remaining internal leakage.
- **Acceptance criteria**:
  - No raw stack or provider internals returned in 500 responses.

---

## 4) Workstream B — Performance Improvements

## B1. Remove N+1 tag lookups in ranking path
- **Current touchpoints**:
  - TS: `packages/openmemory-js/src/memory/hsg.ts` (`compute_tag_match_score`)
  - PY: `packages/openmemory-py/src/openmemory/memory/hsg.py`
- **Plan**:
  - Batch fetch memory/tag rows per query cycle.
  - Cache decoded tags per request.
- **Acceptance criteria**:
  - Query path issues O(1) tag-fetch batches rather than per-candidate fetches.

## B2. Index coverage audit and additions
- **Current touchpoint**: `packages/openmemory-js/src/core/db.ts`
- **Plan**:
  - Validate indexes against query predicates (`user_id`, `primary_sector`, `segment`, temporal filters, waypoints).
  - Add missing additive indexes with migration guard checks.
- **Acceptance criteria**:
  - Query plans for top endpoints avoid full scans for common filtered reads.

## B3. Hot-path regex/vector micro-optimizations
- **Current touchpoint**: `packages/openmemory-js/src/ops/compress.ts`, `memory/hsg.ts`
- **Plan**:
  - Hoist regex constants out of function hot paths.
  - Avoid repeated parse/normalize in loops.
- **Acceptance criteria**:
  - No behavior change; measurable CPU reduction in benchmark script.

## B4. Connection handling for Postgres mode
- **Current touchpoint**: `packages/openmemory-js/src/core/db.ts`
- **Plan**:
  - Validate pool settings via env (`max`, idle timeout) and document production defaults.
- **Acceptance criteria**:
  - Stable operation under concurrent add/query load without connection starvation.

---

## 5) Workstream C — Code Quality and Reliability

## C1. Retry and backoff for transient embedding failures
- **Touchpoints**: embedding call sites in TS/PY memory add pipeline
- **Plan**:
  - Add bounded exponential backoff for retriable provider failures.
- **Acceptance criteria**:
  - Intermittent provider failures no longer fail the entire request on first attempt.

## C2. Shared sector/config parity between TS and Python
- **Touchpoints**:
  - TS: `packages/openmemory-js/src/memory/hsg.ts`
  - PY: `packages/openmemory-py/src/openmemory/core/constants.py` and `memory/hsg.py`
- **Plan**:
  - Move sector defaults into a shared config artifact (or generated constants) loaded by both stacks.
- **Acceptance criteria**:
  - Sector definitions and weights are consistent across runtimes.

## C3. Background-task observability
- **Touchpoints**: async fire-and-forget branches (`update_user_summary`, reflections, decay/prune)
- **Plan**:
  - Add lightweight structured logs and counters for background failures.
- **Acceptance criteria**:
  - Operators can identify failing background jobs without deep tracing.

---

## 6) Workstream D — Document/Legal Feature Roadmap

> All features below are already identified in the improvement scope; this section turns them into implementation slices with dependencies and testable exits.

## D0. Foundation prerequisites (must ship first)
- Extend metadata conventions for document-centric fields (`doc_type`, `parties`, `effective_dates`, `source_refs`).
- Add migration pattern for additive tables/columns and rollback instructions.
- Define route versioning strategy for new document endpoints.

## D1. Document versioning (HIGH)
- **Touchpoints**: `server/routes/memory.ts`, `memory/hsg.ts`, DB schema in `core/db.ts`
- **Schema plan**:
  - Reuse existing `version` field, add `previous_version_id`, `change_summary`, `diff_blob` (JSON/text).
- **API plan**:
  - `POST /memory/:id/version`
  - `GET /memory/:id/versions`
  - `GET /memory/:id/diff/:other_id`
- **Acceptance criteria**:
  - Version chain is queryable and diff output is deterministic.

## D2. Citation tracking & reference graph (HIGH)
- **Touchpoints**: `ops/extract.ts`, `memory/hsg.ts`, `server/routes/memory.ts` or new `routes/citations.ts`
- **Plan**:
  - Add citation extraction pass (regex + normalization) during ingest/update.
  - Store citations as linked memories/metadata edges.
- **Acceptance criteria**:
  - Can retrieve citations for a document and reverse-lookup documents by citation.

## D3. Structured metadata extraction (MEDIUM)
- **Touchpoints**: `ops/extract.ts` (TS), `ops/extract.py` (PY)
- **Plan**:
  - Introduce schema-driven extraction per doc type.
  - Validate extracted payload with zod/pydantic before persistence.
- **Acceptance criteria**:
  - Extraction output is typed, validated, and stored without breaking existing metadata users.

## D4. Change tracking / redline classification (MEDIUM)
- **Touchpoints**: versioning APIs + diff utility module
- **Plan**:
  - Generate word/line diffs and classify substantive changes (financial/date/party/general).
- **Acceptance criteria**:
  - API returns summary + categorized change set.

## D5. Audit trail system (HIGH)
- **Touchpoints**: middleware layer, DB schema, route wrappers
- **Plan**:
  - Add append-only audit table and middleware hook for mutating document actions.
  - Add read endpoint with filters + pagination.
- **Acceptance criteria**:
  - Create/update/delete/version actions are traceable by actor/time/resource.

## D6. Template management (MEDIUM)
- **Touchpoints**: new route module + storage table + render utility
- **Plan**:
  - CRUD templates, typed variable schema, instantiate to memory entry.
- **Acceptance criteria**:
  - Template instantiation validates required variables and produces stored output.

## D7. Compliance rules engine (LOW / COMPLEX)
- **Touchpoints**: new validation service + route + optional temporal facts integration
- **Plan**:
  - Start with deterministic rule checks (required clause/prohibited term/field present).
  - Keep LLM-based checks explicitly optional.
- **Acceptance criteria**:
  - Rule run produces reproducible violation report with severity levels.

## D8. Clause similarity detection (LOW)
- **Touchpoints**: extraction pipeline + similarity query endpoint
- **Plan**:
  - Segment documents into clauses, store clause-level vectors/metadata, expose nearest-neighbor search.
- **Acceptance criteria**:
  - Returns similar clauses above configurable threshold excluding same clause ID.

## D9. Quick wins (1–2 day slices)
- Document type detection
- Party extraction
- Date extraction + normalization

Each quick win should land behind ingestion metadata enrichment, without API breaking changes.

---

## 7) Implementation Sequence (Recommended)

### 7.1 Parallel execution lanes (apply in every phase)

- **Lane 1 — API/Schema**: route updates, migrations, storage/index changes
- **Lane 2 — Extraction/Memory Logic**: parsing, classification, ranking, retry logic
- **Lane 3 — SDK/Parity**: Python parity updates and compatibility checks
- **Lane 4 — Validation/Docs**: tests, benchmarks, security checks, and docs updates

When a phase starts, schedule independent items across these lanes concurrently (for example: `A2 + B2 + C3` can run in parallel by separate owners, then merge after validation).

### Phase 0 — Hardening + enablement (Week 1)
- A1, A2, A4
- D0 foundation
- Baseline metrics and benchmark scripts

### Phase 1 — Performance + auditability (Weeks 2–3)
- B1, B2, B3
- C3
- D5 audit trail

### Phase 2 — Core document intelligence (Weeks 4–6)
- D1 versioning
- D4 redline detection
- D9 quick wins

### Phase 3 — Retrieval depth (Weeks 7–9)
- D2 citation tracking
- D3 structured extraction
- D8 clause similarity

### Phase 4 — Workflow automation (Weeks 10–12)
- D6 template management
- D7 compliance rules engine
- C1 reliability retries
- C2 TS/PY config parity

---

## 8) Test & Validation Strategy

## 8.1 Unit tests (new/expanded)
- Route handlers for new document endpoints
- Extraction/parsing normalization utilities
- Diff classification and citation regex normalization
- Auth/CORS/rate-limit behavior branches

## 8.2 Integration tests
- End-to-end: ingest → version → diff → audit entries
- End-to-end: ingest legal text → citation extraction → citation search
- End-to-end: template instantiate → memory add → query recall

## 8.3 Performance checks
- Before/after query latency for tagged multi-candidate queries
- DB query plan snapshot checks for indexed predicates

## 8.4 Security checks
- Auth required mode behavior
- CORS allowlist behavior
- Webhook signature verification regression
- Error response leakage regression

---

## 9) Risks, Dependencies, and Mitigations

- **Risk**: Divergence between Node and Python behavior.
  - **Mitigation**: parity matrix + shared config artifacts + conformance tests.
- **Risk**: Schema bloat from document-specific features.
  - **Mitigation**: additive schema + clear migration gates + metadata namespacing.
- **Risk**: False positives in citation/compliance extraction.
  - **Mitigation**: deterministic first-pass rules + confidence scoring + review tooling.
- **Risk**: Throughput regressions from added processing.
  - **Mitigation**: async/background extraction path with configurable toggles.

---

## 10) Definition of Done for the Improvement Program

The program is complete when:

1. Security hardening items in Workstream A are implemented and documented.
2. Performance items in Workstream B show measurable improvements.
3. Reliability/code quality items in Workstream C are merged with tests.
4. Document/legal features in Workstream D are delivered per phase with acceptance criteria met.
5. Node + Python user-facing behavior is documented where parity differs.

---

## 11) Tracking Checklist

- [ ] Phase 0 complete
- [ ] Phase 1 complete
- [ ] Phase 2 complete
- [ ] Phase 3 complete
- [ ] Phase 4 complete
- [ ] Final parity/security/perf sign-off complete
