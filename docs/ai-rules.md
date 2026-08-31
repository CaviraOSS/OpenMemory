<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : docs/ai-rules.md
 usage : documents LongMemory ai rules
-->

# AI Rules

- Preserve immutable memory content identity and project isolation.
- Never claim VS Code edit-origin attribution that the stable API cannot prove.
- Explicit agent sessions may be recorded; heuristic candidates require review.
- Exclude sensitive/generated paths, redact credential-like lines, and bound all
  captured document, session, and patch data.
- Keep finite recall and inspection commands read-only.
- Skill updates create superseding versions; code impact must remain tied to
  persisted source snapshots; session import preserves original timestamps.
- Only approved, unexpired assets may enter loadouts. ACL denies override allows;
  visibility never grants manage/assign/share; runtime identity is authoritative.
- Coding-harness adapters are read-only. Stable porter identity is source harness
  plus native session ID; changed history creates immutable revisions.
- Never claim compressed DeepSeek Harness support unless every concatenated
  Zstandard frame is decoded; raw JSONL support must fail closed on other encodings.
- Conversation-to-wiki conversion must remain deterministic and provenance-rich;
  do not present transcript normalization as an AI-generated factual summary.
- Benchmark scorecards must fail closed on incomplete official datasets and use
  N/A for unsupported BEAM, historical QA, or unpriced costs; never render zero
  as a substitute for missing measurement.
- CLI main detection must compare canonical real paths so linked npm shims work.
  Keep only one extension publisher installed for the `longmemory.*` namespace.
- External integrations must use each host's actual extension contract: native
  n8n community nodes, portable Agent Plugins bundles for OpenClaw, and MCP
  clients where the host supports MCP directly. Never write into proprietary
  stores or embed credential values in plugin artifacts.
