<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : docs/decisions.md
 usage : documents LongMemory decisions
-->

# Decisions

## Static Website Memory Lab

- Cloudflare Pages hosts a one-chatbox, browser-only lab. No comparison API,
  proxy, credentials, external inference calls, or separate service is needed.
- Reuse the portable LongMemory claim extractor verbatim and small public
  utility/schema ports where available. Unsupported inference is explicitly
  modelled; Supermemory's private engine cannot be included. Local architecture
  scores must not be presented as full product benchmarks.
- Apply the same input analysis and provider-independent readiness, grounding,
  freshness, redundancy, and token-efficiency algorithm to every representation.
  Tokenize context locally; dollar cost is a declared common-rate scenario, not
  provider billing. No brand-specific scores, ordering, or winner badges.
- Lab evidence preserves original LongMemory claim statements, matching the
  engine renderer. Coverage checks normalized values and explicit directional
  restrictions instead of rewarding filler-word overlap. Repetition and stale
  context remain penalties; rankings are not forced.
- Explicit current-time associative questions put current evidence ahead of
  superseded evidence without changing admission gates or removing history.
- First-person profile/contact clauses and explicit mode/theme switches are
  parsed by the engine. Raw event content remains immutable.

## Optional Evidence-First Reader

- Keep model-assisted answering separate from deterministic memory retrieval and
  reconciliation. Callers supply authorized evidence and a tool-free model
  callback; no provider, deployment, language, or domain is hard-coded.
- Default to evidence-only answers. General inference is explicit opt-in and
  returned separately. Abstention is a status with a null answer, not a forced
  English user-facing phrase. Exact source excerpts retain their language.
- Limit the first implementation to one model invocation, with source/output
  bounds, timeout/cancellation, and no automatic retries or additional retrieval.
  Schema and citation validation do not certify entailment, completeness, or
  truth. Preserve all existing memory, HTTP, and MCP behavior.

## Associative Recall as One Deep Module

- Ranking vs evidence dilution is two _field groups on `associative_policy`_,
  not two public modules. Callers use `associative_recall(query, deps, policy)`.
  Env flags and `memory_config.associative_policy` are adapters of that struct.
- Fusion, matrix, hopfield, rerank, spread, and evidence-set helpers fail the
  deletion test as importable seams (one production caller). Stop barrel-exporting
  them. Keep `build_context_packet` shared with strict/grounded recall.
- Do not pluginize stages. Do not add policy to `src/index.ts`. Spec:
  `.specs/specs/architecture-associative-recall.md`.
