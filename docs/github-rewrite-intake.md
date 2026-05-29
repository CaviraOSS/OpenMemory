# GitHub Rewrite Intake

## Scope
- Source: `docs/github-issues-prs-full-audit.md` and `.json`.
- Coverage reviewed: 42 issues and 94 pull requests from public open/closed GitHub history.
- Purpose: convert historical requests and fixes into architecture rewrite decisions: add now, add later, already covered, defer, or reject.

## Staff Decision
Do not implement history literally. The issue/PR history proves OpenMemory became hard to work on because too many surfaces were active at once: MCP, dashboard, Docker, Python, SQLite, Postgres, providers, HSG, temporal graph, docs, and connectors. The rewrite should pull only durable product requirements into the JS package, then rebuild integrations as thin adapters.

## Add Now Or Keep Active
These are core product requirements and should stay in the near-term JS/Postgres rewrite.

| Requirement | Evidence | Action |
| --- | --- | --- |
| Unicode-safe storage, dedup, and recall | Issues #96, #129, #147, #173; PRs #56, #153 | Keep language-aware tokenization, simhash fixes, and multilingual tests. Add regression cases for Cyrillic multi-record storage and Chinese dedup. |
| Tenant/user/project isolation everywhere | Issues #28, #32, #97; PRs #1, #12, #23, #31, #84, #93, #171 | Keep durable tenant/project predicates, global-project visibility rules, 404-on-mismatch behavior, and malformed-body validation. Extend every revived surface with isolation tests. |
| Durable memory lifecycle parity | Issue #10; PR #12 | Already part of unprefixed durable api: create/get/list/update/reinforce/delete/version/audit. Keep compatibility at SDK/CLI level. |
| Npm/fork startup reliability | Issues #91, #101, #126; PRs #86, #113, #156 | Keep package root server-safe, `npm run build`, `npm run start`, `npm run release-smoke`, and npm-only release workflow. Avoid hidden server startup on import. |
| Embedding provider correctness and timeouts | Issues #15, #30, #58, #114; PRs #18, #52, #55, #68, #74, #151, #174 | Keep provider selection direct and bounded. Add provider tests around model names, fallback, and timeouts before adding more providers. |
| Postgres/pgvector as durable storage | Issue #40; PRs #69, #70, #75, #110 | Keep Postgres-only active runtime and pgvector index strategy. Do not reintroduce SQLite or Valkey as active backends. |
| Text structure preservation | Issues #50, #96; PRs #16, #72 | Preserve content exactly where possible. Any extraction/chunking must keep roundtrip fixtures for nested lists and long paragraphs. |

## Add Next After Current Core Is Stable
These are valuable, but they must be rebuilt on durable unprefixed api semantics instead of restored from old code.

| Requirement | Evidence | Action |
| --- | --- | --- |
| MCP server/tools | Issues #6, #32, #34, #35, #76, #91, #104, #111, #115, #126, #176; PRs #37, #45, #46, #53, #78, #88, #106, #108, #112, #138, #149 | Rebuild after durable API stabilizes. Required tests: STDIO has no stdout logs, current SDK schema validation, per-request transport, update/delete tools, user/project scope. |
| Source connector framework | Issues #33, #175, #176; PRs #9, #146 | Rebuild as source events plus extraction candidates under `/ingest`. Start with webhook/HMAC verification, then GitHub/Notion/Google/URL as optional adapters. |
| Document and URL ingestion | Issue #33; PRs #16, #146 | Reintroduce only as optional extraction adapters that create candidates. Heavy deps stay optional. No old `/retention/ingest`. |
| Explicit decay/compression jobs | Issue #141; PRs #56, #73, #132 | Add only as explicit audited admin operations. No background timers. Use recall-impact evals before automatic changes. |
| Temporal query support | Issue #105; PRs #79, #108, #163 | Map to durable bitemporal/graph schema. Do not restore old temporal route/storage code. |
| Benchmarks/evals | Issue #7 | Add later as recall-quality evaluation, not as runtime code. Use LOCOMO/LongMemEval only after API stabilizes. |
| Docker image and compose | Issues #71, #94, #99, #133, #134, #135, #140, #142, #150; PRs #4, #5, #20, #95, #100, #127, #138, #139, #143, #145, #154, #157, #159, #160, #170 | Add after local npm/fork startup is boring. Compose should be Postgres + JS server only. Hosted deploy buttons stay deferred. |

## Defer Product Surfaces
These should not be in the default server path until the JS package is stable.

| Surface | Evidence | Reason |
| --- | --- | --- |
| Dashboard/frontend | Issues #11, #82, #89, #99, #116, #133; PRs #14, #83, #100, #143, #145, #160, #161, #164, #168 | Historically caused packaging, build, CORS, Docker, and undefined-vector bugs. Rebuild later against unprefixed durable api. |
| VS Code/editor hooks | PRs #124, #162; issue family around IDE/CORS | Useful later, but not part of server/package core. |
| Hosted deploy templates | Issues #136, #142; PRs #154, #157, #159 | Historically stale. Re-add only after the package and Docker path are stable. |
| External graph stores/FalkorDB | PR #179 | Interesting, but do not add a second graph store before durable graph semantics are stable. |
| Python SDK/examples | Issues #103, #125, #129; PRs #131, #144, #155 | Out of scope for JS-only rewrite. Do not spend current pass on Python compatibility. |

## Reject Or Treat As Historical Noise
- Ads/third-party pitches: issues #158, #166, #175. Mine no product code from these.
- Old SQLite persistence fixes: issues #34, #94, #135; PRs #80, #127, #139. Historical signal only. Active runtime is Postgres-only.
- Old HSG wholesale changes: issue #141; PRs #57, #77, #132. Mine scoring/decay ideas only, not the HSG architecture.
- Broad dashboard packaging fixes: useful evidence, but not code to bring back now.

## Already Covered By Current Rewrite
- Durable lifecycle and update/delete behavior: `/memories` routes.
- Tenant/project filtering and global project visibility.
- Package import safety and `npm run start` server path.
- Unicode-aware language metadata, simhash, token count, and lexical recall scoring.
- Postgres-only durable schema and pgvector path.
- CLI add/query/list/delete against unprefixed durable api.
- Release smoke and package content checks.

## Concrete Backlog To Add
1. Add explicit multilingual regression tests for Cyrillic repeated memories and Chinese dedup/recall.
2. Add provider config tests for invalid model names, fallback chain, request timeout, and Gemini current model name.
3. Add durable source-ingestion contract doc and port webhook HMAC verification first.
4. Add optional document/URL extraction adapter plan with dependency boundaries and exact-content preservation tests.
5. Add explicit audited decay/compression admin job design; no timer or automatic mutation.
6. Add MCP rebuild design after unprefixed durable api hardening: STDIO, schema, per-request transport, tenant/project, update/delete/list tools.
7. Add Postgres-only Docker compose plan after local npm startup remains stable.
8. Add temporal query design mapped to durable bitemporal graph tables.
9. Add recall quality evaluation plan using LOCOMO/LongMemEval after API shape is stable.
10. Keep dashboard, IDE, hosted deploy, Python, and external graph stores out of the current runtime.

## Traceability Index
- Issues reviewed: #6, #7, #10, #11, #15, #21, #28, #30, #32, #33, #34, #60, #71, #76, #82, #89, #91, #92, #94, #96, #97, #99, #101, #103, #125, #126, #129, #133, #134, #135, #136, #137, #140, #141, #142, #147, #150, #158, #166, #173, #175, #176.
- Pull requests reviewed: #1, #4, #5, #9, #12, #14, #16, #17, #18, #19, #20, #23, #24, #25, #26, #27, #29, #31, #37, #38, #39, #42, #43, #45, #46, #47, #48, #49, #51, #52, #53, #54, #55, #56, #57, #68, #69, #70, #72, #73, #74, #75, #77, #78, #79, #80, #81, #83, #84, #85, #86, #88, #93, #95, #100, #106, #108, #110, #112, #113, #124, #127, #128, #130, #131, #132, #138, #139, #143, #144, #145, #146, #148, #149, #151, #153, #154, #155, #156, #157, #159, #160, #161, #162, #163, #164, #168, #169, #170, #171, #172, #174, #178, #179.
