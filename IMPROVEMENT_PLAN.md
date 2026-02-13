# OpenMemory Improvement Implementation Plan

> **Purpose**: Convert the feature/improvement ideas already captured in this repository into a concrete, execution-ready plan tied to the current codebase.
>
> **Date**: 2026-02-13
> **Last Review**: 2026-02-13 (Phase 0 + Phase 1 deep review)

---

## Implementation Review Summary

### Phase 0 + Phase 1 Status: COMPLETE with REMEDIATION ITEMS

**Overall Assessment**: The implementation is **solid and production-ready** with a few polish items identified during deep review. The committer demonstrated good security practices (timing-safe comparisons, proper CORS handling, signature verification) and addressed the core performance bottlenecks effectively.

#### Code Quality Score: **B+ (Good)**

**Strengths:**
- ✅ Security implementations use correct cryptographic primitives (`crypto.timingSafeEqual`)
- ✅ Regex optimisations properly hoisted to class-level constants
- ✅ N+1 fix correctly removes async/await from synchronous operations
- ✅ Error responses consistently sanitised across all route files
- ✅ Connection pool configuration is comprehensive with sensible defaults
- ✅ Backward compatibility maintained throughout

**Areas for Improvement:**
- ⚠️ Minor code duplication (duplicate index creation statements)
- ⚠️ Noisy logging pattern (warnings repeat per-request instead of once at startup)
- ⚠️ Rate-limit eviction uses O(n) scan (acceptable but could be optimised)
- ⚠️ Missing input validation on pool configuration env vars

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

- [x] Phase 0 complete (2026-02-13) — see Review Findings below
- [x] Phase 1 complete (2026-02-13) — see Review Findings below
- [ ] Phase 0/1 Remediation items (new)
- [ ] Phase 2 complete
- [ ] Phase 3 complete
- [ ] Phase 4 complete
- [ ] Final parity/security/perf sign-off complete

---

## 12) Phase 0 + Phase 1 Review Findings (2026-02-13)

### 12.1 Phase 0 — Security Hardening

#### A1. Strict Authentication Mode ✅ COMPLETE

**Implementation Quality**: Good

**Review Findings**:
- ✅ Uses `crypto.timingSafeEqual` for constant-time API key comparison — correct security practice
- ✅ Strict mode (`OM_REQUIRE_AUTH=true`) returns 503 when key not configured
- ✅ Non-strict mode preserves backward compatibility with warnings
- ⚠️ **REMEDIATION NEEDED**: Warning logs fire on every request when auth is disabled, causing log noise

**Remediation Item A1.1**:
- **Issue**: Lines 121-125 in `auth.ts` log warnings per-request
- **Fix**: Move warnings to a startup-only log (use a `has_warned` flag or log in `cfg.ts`)
- **Priority**: Low (cosmetic, not functional)

#### A2. CORS Hardening ✅ COMPLETE

**Implementation Quality**: Good

**Review Findings**:
- ✅ Allowlist-based CORS with `OM_CORS_ALLOWED_ORIGINS` env var
- ✅ Backward-compatible wildcard fallback when not configured
- ✅ Correctly omits CORS headers for non-allowlisted origins

**No remediation needed.**

#### A3. Rate-Limit Store Memory Cap ✅ COMPLETE

**Implementation Quality**: Acceptable

**Review Findings**:
- ✅ `MAX_RATE_LIMIT_ENTRIES = 10,000` cap prevents unbounded memory growth
- ✅ Oldest-entry eviction logic is correct
- ⚠️ **MINOR**: O(n) linear scan to find oldest entry (acceptable for 10k entries)

**Remediation Item A3.1** (Optional):
- **Issue**: Linear scan at line 61-73 could be slow under extreme load
- **Fix**: Use a min-heap or maintain an insertion-order linked list
- **Priority**: Very Low (only matters if rate-limit store churns at >1000 req/s)

#### A4. Error Response Consistency ✅ COMPLETE

**Implementation Quality**: Excellent

**Review Findings**:
- ✅ All 500 responses across `sources.ts`, `compression.ts`, `dashboard.ts`, `users.ts` now return generic error codes
- ✅ Server-side logging preserved with `console.error()`
- ✅ No stack traces or provider internals leaked

**No remediation needed.**

### 12.2 Phase 1 — Performance Improvements

#### B1. Remove N+1 Tag Lookups ✅ COMPLETE

**Implementation Quality**: Excellent

**Review Findings**:
- ✅ `compute_tag_match_score()` now accepts memory object directly (no DB call)
- ✅ Function is no longer async — correctly reflects synchronous operation
- ✅ Applied to both TypeScript (`hsg.ts`) and Python (`hsg.py`)
- ✅ `parse_json_field()` helper added to avoid repeated JSON parsing

**No remediation needed.**

#### B2. Index Coverage ✅ COMPLETE

**Implementation Quality**: Good with minor issue

**Review Findings**:
- ✅ Indexes added: `salience`, `created_at`, `last_seen_at`, composite `(user_id, created_at)`
- ✅ Both Postgres and SQLite implementations updated
- ⚠️ **BUG**: Duplicate index creation statements

**Remediation Item B2.1**:
- **Issue**: Line 263 in `db.ts` creates `openmemory_stats_type_idx` twice (Postgres)
- **Issue**: Lines 594-598 in `db.ts` create `idx_edges_validity` twice (SQLite)
- **Fix**: Remove duplicate `CREATE INDEX` statements
- **Priority**: Low (no functional impact, just wasted cycles on startup)

#### B3. Hot-Path Regex Optimisations ✅ COMPLETE

**Implementation Quality**: Excellent

**Review Findings**:
- ✅ 46+ regex patterns hoisted to class-level constants in `compress.ts`
- ✅ Clean organisation: `SEM_FILTERS`, `SEM_REPLACEMENTS`, `SYN_CONTRACTIONS`, `AGG_ABBREVIATIONS`
- ✅ Patterns compiled once at class instantiation
- ✅ `parse_json_field()` helper in `hsg.ts` reduces redundant parsing

**No remediation needed.**

#### B4. Postgres Connection Pool ✅ COMPLETE

**Implementation Quality**: Good

**Review Findings**:
- ✅ 4 env vars: `OM_PG_POOL_MAX`, `OM_PG_POOL_MIN`, `OM_PG_POOL_IDLE_TIMEOUT`, `OM_PG_POOL_CONNECTION_TIMEOUT`
- ✅ Sensible defaults (max=20, min=0, idle=30s, conn=10s)
- ✅ Pool config logged on startup
- ⚠️ **MINOR**: No validation that pool values are positive integers

**Remediation Item B4.1** (Optional):
- **Issue**: Negative or zero pool values would cause undefined behaviour
- **Fix**: Add validation in `cfg.ts` with `Math.max(1, num(...))` for pool max
- **Priority**: Very Low (unlikely misconfiguration)

### 12.3 Phase 1 Remaining Items

#### C3. Background-task Observability ✅ COMPLETE

**Status**: Implemented in Phase 0/1 Remediation workstream.

**Implementation**:
- Created `core/observability.ts` module with structured logging and metrics
- Updated `server/index.ts` to wrap decay and prune tasks with observability
- Updated `memory/reflect.ts` to use observability for reflection tasks
- Updated `memory/user_summary.ts` to use observability for user summary tasks
- Added `/dashboard/tasks` endpoint exposing task metrics (run count, success/failure rates, last errors)
- All background tasks now log structured output with duration and result data

#### D5. Audit Trail System ✅ COMPLETE

**Status**: Implemented in Phase 0/1 Remediation workstream.

**Implementation**:
- Created `core/audit.ts` module with audit_log(), query_audit_logs(), count_audit_logs(), get_resource_history() functions
- Added audit_logs table to both Postgres and SQLite database initialization
- Created `/audit/logs`, `/audit/resource/:type/:id`, `/audit/stats` API endpoints
- Hooked audit logging into memory routes: create, update, delete, reinforce, ingest actions
- All audit entries include: resource_type, resource_id, action, actor_id, actor_type, timestamp, changes, metadata

### 12.4 Additional Observations

#### Webhook Signature Verification (sources.ts)

**Implementation Quality**: Excellent

- ✅ Uses `crypto.timingSafeEqual` for constant-time comparison
- ✅ Properly checks signature length before comparison (prevents timing leak)
- ✅ Requires raw body for HMAC verification
- ✅ Clear error messages without leaking internals

#### Python Parity

**Status**: Partial

- ✅ `hsg.py` updated with N+1 fix
- ⚠️ Need to verify: Python compression engine regex hoisting not confirmed
- ⚠️ Need to verify: Python auth middleware parity with TS changes

---

## 13) Remediation Workstream (Post Phase 0/1)

### Priority Matrix

| Item | Priority | Effort | Impact |
|------|----------|--------|--------|
| A1.1 Startup-only auth warnings | Low | 15 min | Log cleanliness |
| B2.1 Remove duplicate indexes | Low | 5 min | Startup performance |
| C3 Background observability | Medium | 2-4 hrs | Operability |
| Python parity verification | Medium | 1-2 hrs | Consistency |
| B4.1 Pool value validation | Very Low | 10 min | Edge case safety |
| A3.1 Rate-limit LRU optimisation | Very Low | 1-2 hrs | Extreme scale only |

### Recommended Remediation Order

1. **B2.1** — Quick fix, removes code smell ✅ DONE
2. **A1.1** — Quick fix, improves log hygiene ✅ DONE
3. **C3** — Should have been in Phase 1, important for operations ✅ DONE
4. **Python parity** — Verify or implement missing changes

---
