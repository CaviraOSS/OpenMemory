# GitHub Issues And PR Audit

Superseded by the deeper item-level audit in `docs/github-issues-prs-full-audit.md` and `docs/github-issues-prs-full-audit.json`.

## Scope
- Repository: `CaviraOSS/OpenMemory`.
- Date: 2026-05-19.
- Source: public GitHub issue and pull request listing pages. The REST API was rate-limited from this network during the audit, so this records the public listing metadata rather than full issue/PR bodies and comments.
- GitHub UI header showed 7 open issues and 3 open PRs. The PR page showed 3 open and 91 closed PRs. Public listing scrape found 36 issue entries and 94 PR entries.

## Product Signals From Issues
- Multilingual correctness is real user pain: Cyrillic truncation/first-record behavior, Chinese dedup/tokenization, and Chinese Claude memory truncation all point to Unicode-safe tokenization and storage as non-negotiable.
- MCP compatibility has been a recurring source of bugs: schema dialect, STDIO logging, tool naming, tenant/user isolation, and Claude compatibility.
- Docker/deploy reliability generated repeated issues and PRs. The active rewrite should keep local/fork/npm startup simple before reviving hosted deploy presets.
- User/project isolation bugs appear in issues and PR history. Durable tenant/project filters must stay tested.
- Dashboard/IDE/Vercel/provider requests exist, but they should remain deferred until the server core is stable.

## Product Signals From PRs
- Many PRs were fixes around deployment, dashboard packaging, MCP compatibility, SQLite persistence, and docs. That supports the current cleanup direction: remove deferred surfaces from the default runtime.
- Several useful algorithmic improvements exist: vector ANN search, multi-sector search, embedding timeouts/fallbacks, multilingual simhash, project-level isolation, salience/waypoint clamping, and explicit metadata filters.
- Open PR #179 proposes FalkorDB/GraphRAG integration. Treat this as deferred until durable graph semantics are complete; do not add a second graph store during the core rewrite.

## Issues Listed
| # | Status | Title | Link | Rewrite relevance |
| ---: | --- | --- | --- | --- |
| 176 | Open | feat: Add Grok Connectors / BYO MCP integration guide | [#176](https://github.com/CaviraOSS/OpenMemory/issues/176) | Deferred MCP rebuild signal |
| 175 | Not planned (skipped) | ⚡ Pay-per-call web search, scraping & AI tools for your agent — VERITY (L402) | [#175](https://github.com/CaviraOSS/OpenMemory/issues/175) | Reference |
| 173 | unknown | [BUG] Cyrillic Text Only First Record Saved | [#173](https://github.com/CaviraOSS/OpenMemory/issues/173) | Unicode/text correctness |
| 166 | Closed (completed) | Hi, I recently released an open indexing-layer project called SCBKR Memory Index. | [#166](https://github.com/CaviraOSS/OpenMemory/issues/166) | Reference |
| 158 | Closed (completed) | 分享: OpenMemory 在接入大语言模型接口时如何绕过风控的一些经验 | [#158](https://github.com/CaviraOSS/OpenMemory/issues/158) | Reference |
| 150 | unknown | [FEATURE] Publish a docker image | [#150](https://github.com/CaviraOSS/OpenMemory/issues/150) | Startup/deploy/docs reliability |
| 147 | unknown | [BUG] Chinese text is incorrectly deduplicated in openmemory_store due to ASCII-only tokenization | [#147](https://github.com/CaviraOSS/OpenMemory/issues/147) | Unicode/text correctness |
| 142 | unknown | [BUG] render deploy doesn't work | [#142](https://github.com/CaviraOSS/OpenMemory/issues/142) | Startup/deploy/docs reliability |
| 141 | Open | [Performance] Refactor HSG waypoint creation to use vector store ANN search. | [#141](https://github.com/CaviraOSS/OpenMemory/issues/141) | Reference |
| 140 | unknown | [BUG] Docker Compose fails && No Backend Folder | [#140](https://github.com/CaviraOSS/OpenMemory/issues/140) | Startup/deploy/docs reliability |
| 137 | unknown | [BUG] Official example not working. | [#137](https://github.com/CaviraOSS/OpenMemory/issues/137) | Startup/deploy/docs reliability |
| 136 | unknown | [BUG] Official Docs Deployment Down | [#136](https://github.com/CaviraOSS/OpenMemory/issues/136) | Startup/deploy/docs reliability |
| 116 | unknown | [BUG] dashboard lost | [#116](https://github.com/CaviraOSS/OpenMemory/issues/116) | Deferred surface/feature request |
| 115 | unknown | [BUG] MCP not working on Claude models in antigravity? | [#115](https://github.com/CaviraOSS/OpenMemory/issues/115) | Deferred MCP rebuild signal |
| 114 | unknown | [BUG] Ollama embeddings crash due to EnvConfig attribute mismatch | [#114](https://github.com/CaviraOSS/OpenMemory/issues/114) | Reference |
| 111 | unknown | [BUG] MCP tools fail Claude validation: JSON schema must match Draft 2020-12 | [#111](https://github.com/CaviraOSS/OpenMemory/issues/111) | Deferred MCP rebuild signal |
| 105 | Closed (completed) | Temporal filtering parameters (startTime/endTime) not exposed in /query endpoint | [#105](https://github.com/CaviraOSS/OpenMemory/issues/105) | Reference |
| 104 | unknown | [BUG] MCP STDIO Transport Fails: console.log in db.ts breaks JSON-RPC protocol | [#104](https://github.com/CaviraOSS/OpenMemory/issues/104) | Deferred MCP rebuild signal |
| 103 | unknown | [BUG] Missing dependencies in python sdk 1.3.0 | [#103](https://github.com/CaviraOSS/OpenMemory/issues/103) | Reference |
| 101 | Closed (completed) | Release for Openmemory-js | [#101](https://github.com/CaviraOSS/OpenMemory/issues/101) | Reference |
| 99 | unknown | [FEATURE] Add Docker Image for Dashboard | [#99](https://github.com/CaviraOSS/OpenMemory/issues/99) | Startup/deploy/docs reliability |
| 97 | unknown | [BUG] Query reutrns result on all users even with filters value | [#97](https://github.com/CaviraOSS/OpenMemory/issues/97) | Tenant/project isolation |
| 96 | unknown | [BUG] Content corruption and truncation with nested list structures | [#96](https://github.com/CaviraOSS/OpenMemory/issues/96) | Reference |
| 94 | Closed (completed) | [BUG] SQLite memories not loading on container startup (race condition) | [#94](https://github.com/CaviraOSS/OpenMemory/issues/94) | Storage rewrite signal |
| 60 | unknown | [FEATURE] Semantic search on the docs site | [#60](https://github.com/CaviraOSS/OpenMemory/issues/60) | Deferred surface/feature request |
| 58 | Closed (completed) | Ollama embedding config references non-existent model 'bge-small' | [#58](https://github.com/CaviraOSS/OpenMemory/issues/58) | Reference |
| 50 | unknown | [BUG] Claude code 记录的记忆会被截断 | [#50](https://github.com/CaviraOSS/OpenMemory/issues/50) | Unicode/text correctness |
| 44 | unknown | [FEATURE] Vercel AI SDK support | [#44](https://github.com/CaviraOSS/OpenMemory/issues/44) | Deferred surface/feature request |
| 41 | unknown | [BUG] No lib folder is there unable to build the dashboard | [#41](https://github.com/CaviraOSS/OpenMemory/issues/41) | Deferred surface/feature request |
| 40 | unknown | [BUG] No Postgres Migration SQL scripts in repo | [#40](https://github.com/CaviraOSS/OpenMemory/issues/40) | Storage rewrite signal |
| 35 | unknown | [BUG] Tool naming and openmemory://config endpoint issues with Windsurf MCP | [#35](https://github.com/CaviraOSS/OpenMemory/issues/35) | Deferred MCP rebuild signal |
| 34 | unknown | [BUG] Concurrent openmemory.store Calls from Gemini CLI Cause SQLite Transaction Errors | [#34](https://github.com/CaviraOSS/OpenMemory/issues/34) | Storage rewrite signal |
| 33 | unknown | [BUG] File ingestion API not working | [#33](https://github.com/CaviraOSS/OpenMemory/issues/33) | Deferred surface/feature request |
| 32 | unknown | [FEATURE] Expose user isolation to MCP endpoints | [#32](https://github.com/CaviraOSS/OpenMemory/issues/32) | Deferred MCP rebuild signal |
| 30 | unknown | [BUG] Model name bge-small in embedding map does not exist in Ollama | [#30](https://github.com/CaviraOSS/OpenMemory/issues/30) | Reference |
| 28 | unknown | [FEATURE] How to have multiple users supprt? | [#28](https://github.com/CaviraOSS/OpenMemory/issues/28) | Tenant/project isolation |

## Pull Requests Listed
| # | Status | Title | Link | Rewrite relevance |
| ---: | --- | --- | --- | --- |
| 179 | open | Add FalkorDB GraphRAG bridge integration and hardening | [#179](https://github.com/CaviraOSS/OpenMemory/pull/179) | Defer graph-store integration |
| 178 | merged | Cleanup | [#178](https://github.com/CaviraOSS/OpenMemory/pull/178) | Reference |
| 174 | merged | fix: replace deprecated Gemini embedding model (text-embedding-004 → gemini-embedding-001) | [#174](https://github.com/CaviraOSS/OpenMemory/pull/174) | Algorithm/provider idea |
| 172 | merged | chore(openmemory-js): security & test hardening (P1+P2 close-out) | [#172](https://github.com/CaviraOSS/OpenMemory/pull/172) | Reference |
| 171 | merged | Project-Level Memory Isolation (.2 boost) with merged global memories | [#171](https://github.com/CaviraOSS/OpenMemory/pull/171) | API correctness/security |
| 170 | merged | ci: publish backend image to GHCR | [#170](https://github.com/CaviraOSS/OpenMemory/pull/170) | Storage/deploy cleanup signal |
| 169 | merged | Add Windows OpenMemory service scripts | [#169](https://github.com/CaviraOSS/OpenMemory/pull/169) | Reference |
| 168 | merged | fix(dashboard): add process-level error safety net | [#168](https://github.com/CaviraOSS/OpenMemory/pull/168) | Deferred app surface |
| 164 | merged | docs: replace dashboard template readme | [#164](https://github.com/CaviraOSS/OpenMemory/pull/164) | Deferred app surface |
| 163 | merged | fix: accept top-level temporal query filters | [#163](https://github.com/CaviraOSS/OpenMemory/pull/163) | Reference |
| 162 | merged | fix: honor IDE allowed origins for IDE routes | [#162](https://github.com/CaviraOSS/OpenMemory/pull/162) | Deferred app surface |
| 161 | merged | docs: fix dashboard backend source paths | [#161](https://github.com/CaviraOSS/OpenMemory/pull/161) | Deferred app surface |
| 160 | merged | fix: copy dashboard package manifests from builder | [#160](https://github.com/CaviraOSS/OpenMemory/pull/160) | Storage/deploy cleanup signal |
| 159 | merged | fix: include dev dependencies in Render build | [#159](https://github.com/CaviraOSS/OpenMemory/pull/159) | Storage/deploy cleanup signal |
| 157 | merged | docs: remove obsolete deploy buttons from README | [#157](https://github.com/CaviraOSS/OpenMemory/pull/157) | Docs signal |
| 156 | merged | docs: fix Node SDK package name | [#156](https://github.com/CaviraOSS/OpenMemory/pull/156) | Docs signal |
| 155 | merged | docs: fix Python package name in getting started | [#155](https://github.com/CaviraOSS/OpenMemory/pull/155) | Docs signal |
| 154 | merged | docs: remove broken Railway deploy button | [#154](https://github.com/CaviraOSS/OpenMemory/pull/154) | Docs signal |
| 153 | merged | fix(openmemory): prevent multilingual simhash collisions across JS and Python | [#153](https://github.com/CaviraOSS/OpenMemory/pull/153) | Algorithm/provider idea |
| 151 | merged | feat: add MiniMax as AI provider for chat and embeddings | [#151](https://github.com/CaviraOSS/OpenMemory/pull/151) | Algorithm/provider idea |
| 149 | merged | fix(mcp): support MCP SDK 1.27+ by creating per-request transport | [#149](https://github.com/CaviraOSS/OpenMemory/pull/149) | Deferred MCP rebuild signal |
| 148 | merged | fix: correct broken link to API docs in ARCHITECTURE.md | [#148](https://github.com/CaviraOSS/OpenMemory/pull/148) | Docs signal |
| 146 | merged | fix(migrate): support Supermemory v3 documents list API | [#146](https://github.com/CaviraOSS/OpenMemory/pull/146) | Reference |
| 145 | closed | Add docker build dashboard | [#145](https://github.com/CaviraOSS/OpenMemory/pull/145) | Storage/deploy cleanup signal |
| 144 | merged | fix(ci): install pytest for python sdk omnibus test | [#144](https://github.com/CaviraOSS/OpenMemory/pull/144) | Reference |
| 143 | merged | Fix dashboard ui profile build by restoring dashboard sources | [#143](https://github.com/CaviraOSS/OpenMemory/pull/143) | Deferred app surface |
| 139 | merged | fix: use absolute /data path for SQLite in .env.example to match Docker volume | [#139](https://github.com/CaviraOSS/OpenMemory/pull/139) | Storage/deploy cleanup signal |
| 138 | merged | Improve Docker reliability and document compose usage | [#138](https://github.com/CaviraOSS/OpenMemory/pull/138) | Storage/deploy cleanup signal |
| 132 | closed | Add dual-salience support for wisdom retention | [#132](https://github.com/CaviraOSS/OpenMemory/pull/132) | Algorithm/provider idea |
| 131 | merged | Fix unterminated f-string in google_slides.py | [#131](https://github.com/CaviraOSS/OpenMemory/pull/131) | Deferred app surface |
| 130 | merged | Fix issue 129 | [#130](https://github.com/CaviraOSS/OpenMemory/pull/130) | Reference |
| 128 | closed | Feature/add tool dependent sdk exports | [#128](https://github.com/CaviraOSS/OpenMemory/pull/128) | Reference |
| 127 | closed | fix: use absolute path for OM_DB_PATH to ensure Docker volume persistence | [#127](https://github.com/CaviraOSS/OpenMemory/pull/127) | Storage/deploy cleanup signal |
| 124 | closed | feat: Claude Code hooks for automatic memory integration | [#124](https://github.com/CaviraOSS/OpenMemory/pull/124) | Deferred MCP rebuild signal |
| 113 | merged | Bump npm version | [#113](https://github.com/CaviraOSS/OpenMemory/pull/113) | Reference |
| 112 | open | Docker-first defaults: 18080 port, project scoping, MCP update/delete | [#112](https://github.com/CaviraOSS/OpenMemory/pull/112) | Deferred MCP rebuild signal |
| 110 | closed | Claude/postgres pgvector integration x9 p ue | [#110](https://github.com/CaviraOSS/OpenMemory/pull/110) | Deferred MCP rebuild signal |
| 108 | merged | feat(mcp): add temporal graph support to MCP tools | [#108](https://github.com/CaviraOSS/OpenMemory/pull/108) | Deferred MCP rebuild signal |
| 106 | merged | fix(mcp): resolve STDIO protocol violations and PostgreSQL parameter bugs | [#106](https://github.com/CaviraOSS/OpenMemory/pull/106) | Deferred MCP rebuild signal |
| 100 | merged | Feature - Add Frontend Docker Image | [#100](https://github.com/CaviraOSS/OpenMemory/pull/100) | Storage/deploy cleanup signal |
| 95 | open | fix: add database initialization delay to prevent race condition on startup | [#95](https://github.com/CaviraOSS/OpenMemory/pull/95) | Storage/deploy cleanup signal |
| 93 | merged | fix: Add PATCH to CORS allowed methods | [#93](https://github.com/CaviraOSS/OpenMemory/pull/93) | API correctness/security |
| 88 | closed | fix: redirect debug logs to stderr for MCP stdio compatibility | [#88](https://github.com/CaviraOSS/OpenMemory/pull/88) | Deferred MCP rebuild signal |
| 86 | merged | chore(sdk-js): bump version to 1.0.2 | [#86](https://github.com/CaviraOSS/OpenMemory/pull/86) | Reference |
| 85 | merged | fix(sdk-js): transform camelCase to snake_case in remote add payload | [#85](https://github.com/CaviraOSS/OpenMemory/pull/85) | Reference |
| 84 | merged | fix(api): handle null request body in DELETE /memory/:id | [#84](https://github.com/CaviraOSS/OpenMemory/pull/84) | API correctness/security |
| 83 | merged | fix(dashboard): handle undefined vectors in cosineSimilarity | [#83](https://github.com/CaviraOSS/OpenMemory/pull/83) | Algorithm/provider idea |
| 81 | merged | fix: improve timezone support and 30-day chart format | [#81](https://github.com/CaviraOSS/OpenMemory/pull/81) | Reference |
| 80 | merged | fix: SQLite vector table now respects OM_VECTOR_TABLE env variable | [#80](https://github.com/CaviraOSS/OpenMemory/pull/80) | Storage/deploy cleanup signal |
| 79 | merged | fix: Memory Query Load chart timeline ordering and period selection | [#79](https://github.com/CaviraOSS/OpenMemory/pull/79) | Reference |
| 78 | closed | fix: use console.error for debug messages to prevent MCP JSON parse errors | [#78](https://github.com/CaviraOSS/OpenMemory/pull/78) | Deferred MCP rebuild signal |
| 77 | merged | feat: batch sector embeddings for faster queries | [#77](https://github.com/CaviraOSS/OpenMemory/pull/77) | Algorithm/provider idea |
| 75 | merged | PostgreSQL compatibility and vector table configuration | [#75](https://github.com/CaviraOSS/OpenMemory/pull/75) | Storage/deploy cleanup signal |
| 74 | merged | fix: add timeout to embedding API fetch calls | [#74](https://github.com/CaviraOSS/OpenMemory/pull/74) | Algorithm/provider idea |
| 73 | merged | feat(scoring): increase tag_match weight for better explicit signal handling | [#73](https://github.com/CaviraOSS/OpenMemory/pull/73) | Algorithm/provider idea |
| 72 | merged | feat(essence): improve sentence scoring for better title/header retention | [#72](https://github.com/CaviraOSS/OpenMemory/pull/72) | Algorithm/provider idea |
| 70 | merged | Fix PostgreSQL compatibility and user tracking consistency | [#70](https://github.com/CaviraOSS/OpenMemory/pull/70) | Storage/deploy cleanup signal |
| 69 | merged | Add user tracking and PostgreSQL compatibility improvements | [#69](https://github.com/CaviraOSS/OpenMemory/pull/69) | Storage/deploy cleanup signal |
| 68 | merged | feat: add configurable embedding provider fallback chain | [#68](https://github.com/CaviraOSS/OpenMemory/pull/68) | Algorithm/provider idea |
| 57 | merged | fix: Enable multi-sector search for cross-sector memory retrieval | [#57](https://github.com/CaviraOSS/OpenMemory/pull/57) | Algorithm/provider idea |
| 56 | merged | fix: Clamp waypoint weights to [0, 1] range to prevent score corruption | [#56](https://github.com/CaviraOSS/OpenMemory/pull/56) | Algorithm/provider idea |
| 55 | merged | fix: Add warning for embedding configuration mismatch | [#55](https://github.com/CaviraOSS/OpenMemory/pull/55) | Algorithm/provider idea |
| 54 | merged | Fix the order of commands in README.ME | [#54](https://github.com/CaviraOSS/OpenMemory/pull/54) | Docs signal |
| 53 | closed | userid prioritizedly obtained from the request header of the mcp client | [#53](https://github.com/CaviraOSS/OpenMemory/pull/53) | Deferred MCP rebuild signal |
| 52 | merged | feat(embedding): add AWS embedding provider | [#52](https://github.com/CaviraOSS/OpenMemory/pull/52) | Algorithm/provider idea |
| 51 | closed | Zloeber/doc gen | [#51](https://github.com/CaviraOSS/OpenMemory/pull/51) | Reference |
| 49 | merged | Update localhost port from 3000 to 8080 | [#49](https://github.com/CaviraOSS/OpenMemory/pull/49) | Reference |
| 48 | closed | Add computer fundamentals PPT/PDF with practical exercises | [#48](https://github.com/CaviraOSS/OpenMemory/pull/48) | Reference |
| 47 | closed | Feature/nyomi ai chatbot app 7vl | [#47](https://github.com/CaviraOSS/OpenMemory/pull/47) | Reference |
| 46 | merged | Fix: MCP server compatibility issues with Claude Desktop | [#46](https://github.com/CaviraOSS/OpenMemory/pull/46) | Deferred MCP rebuild signal |
| 45 | merged | docs: Add Claude Code HTTP MCP integration instructions | [#45](https://github.com/CaviraOSS/OpenMemory/pull/45) | Deferred MCP rebuild signal |
| 43 | merged | chore(formatter): Added prettier as formatter | [#43](https://github.com/CaviraOSS/OpenMemory/pull/43) | Reference |
| 42 | merged | perf(fuse): Optimized fuse_vecs function to get 2x-12x perf | [#42](https://github.com/CaviraOSS/OpenMemory/pull/42) | Algorithm/provider idea |
| 39 | closed | Claude/ai agents openmemory usage 011 c uq sea6f a91c yi qf pgs hh | [#39](https://github.com/CaviraOSS/OpenMemory/pull/39) | Deferred MCP rebuild signal |
| 38 | closed | Claude/analyze ai agents system 011 c uq e wz dr6 pfj3wq rk c7hh | [#38](https://github.com/CaviraOSS/OpenMemory/pull/38) | Deferred MCP rebuild signal |
| 37 | closed | Fix MCP tool naming to comply with schema requirements | [#37](https://github.com/CaviraOSS/OpenMemory/pull/37) | Deferred MCP rebuild signal |
| 31 | merged | Add permissions for content read access | [#31](https://github.com/CaviraOSS/OpenMemory/pull/31) | API correctness/security |
| 29 | merged | perf(embedding): Optimize embedWithLocal | [#29](https://github.com/CaviraOSS/OpenMemory/pull/29) | Algorithm/provider idea |
| 27 | merged | perf(chunk): Optimized the combineChunk function | [#27](https://github.com/CaviraOSS/OpenMemory/pull/27) | Algorithm/provider idea |
| 26 | merged | perf(vector): Optimized the aggregateVectors function | [#26](https://github.com/CaviraOSS/OpenMemory/pull/26) | Algorithm/provider idea |
| 25 | merged | perf(embedding): Optimize hash, addFeat and norm function | [#25](https://github.com/CaviraOSS/OpenMemory/pull/25) | Algorithm/provider idea |
| 24 | merged | Add MseeP.ai badge | [#24](https://github.com/CaviraOSS/OpenMemory/pull/24) | Docs signal |
| 23 | merged | Fix api auth bug | [#23](https://github.com/CaviraOSS/OpenMemory/pull/23) | API correctness/security |
| 20 | merged | chore(docker): Added bun as package manager for the backend & Dockerfile fixes | [#20](https://github.com/CaviraOSS/OpenMemory/pull/20) | Storage/deploy cleanup signal |
| 19 | closed | Refactor | [#19](https://github.com/CaviraOSS/OpenMemory/pull/19) | Reference |
| 18 | merged | add configuration for OpenAI-compatible embeddings providers | [#18](https://github.com/CaviraOSS/OpenMemory/pull/18) | Algorithm/provider idea |
| 17 | merged | Fix: Supermemory comparison table in README.md | [#17](https://github.com/CaviraOSS/OpenMemory/pull/17) | Docs signal |
| 16 | closed | refactor: ingestion logic to handle oversized paragraphs | [#16](https://github.com/CaviraOSS/OpenMemory/pull/16) | Reference |
| 14 | merged | add initial frontend | [#14](https://github.com/CaviraOSS/OpenMemory/pull/14) | Deferred app surface |
| 12 | merged | Add memory update api | [#12](https://github.com/CaviraOSS/OpenMemory/pull/12) | Reference |
| 9 | merged | Add endpoint documentation | [#9](https://github.com/CaviraOSS/OpenMemory/pull/9) | Docs signal |
| 5 | merged | Fix docker build | [#5](https://github.com/CaviraOSS/OpenMemory/pull/5) | Storage/deploy cleanup signal |
| 4 | merged | refactor: dockerfile to install all dependencies and prune dev | [#4](https://github.com/CaviraOSS/OpenMemory/pull/4) | Storage/deploy cleanup signal |
| 1 | merged | Add Tag and Metadata Filtering to HSG + API Query | [#1](https://github.com/CaviraOSS/OpenMemory/pull/1) | API correctness/security |

## Rewrite Backlog Additions From GitHub History
1. Keep Unicode and multilingual tests around durable create/recall/dedup behavior.
2. Keep MCP out of default startup until rebuilt against durable `/v1` and protocol-tested for STDIO and current SDK schema requirements.
3. Keep Docker/npm startup minimal before adding hosted deploy templates again.
4. Preserve tenant/project isolation tests for every new recall, graph, source, and MCP surface.
5. Treat external graph stores such as FalkorDB as optional adapters after durable graph semantics stabilize.
