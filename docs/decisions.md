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

- Ranking vs evidence dilution is two *field groups on `associative_policy`*,
  not two public modules. Callers use `associative_recall(query, deps, policy)`.
  Env flags and `memory_config.associative_policy` are adapters of that struct.
- Fusion, matrix, hopfield, rerank, spread, and evidence-set helpers fail the
  deletion test as importable seams (one production caller). Stop barrel-exporting
  them. Keep `build_context_packet` shared with strict/grounded recall.
- Do not pluginize stages. Do not add policy to `src/index.ts`. Spec:
  `.specs/specs/architecture-associative-recall.md`.
