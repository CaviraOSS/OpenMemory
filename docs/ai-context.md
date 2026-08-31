<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : docs/ai-context.md
 usage : documents LongMemory ai context
-->

# AI Context

- The product, package, CLI, environment prefix, extension namespace, routes,
  integrations, and active project documentation are named LongMemory.
- Comment-capable active files carry the Cavira header rendered in their native
  comment syntax. Strict JSON, generated binary metadata, binary assets, the
  header template, and n8n's byte-exact ESLint config are explicit exceptions.
- LongMemory uses one Hydrograph engine across the library, CLI, server, MCP,
  dashboard, and VS Code extension.
- The VS Code extension uses stable CLI JSON and workspace project scope; it
  does not duplicate engine behavior.
- AI code changes are stored as compact redacted patches with provenance and
  attribution confidence, not as silent full-file snapshots.
- Project memory includes immutable reusable Skills with agent bindings,
  snapshot-derived code impact queries, and validated past-session import.
- Conversations, Skills, documents, and repositories auto-register as governed
  Chat Memory, Skill, LLM-Wiki, and CodeGraph assets with portable loadouts.
- The CLI session porter reads Claude Code, Codex, and OpenCode into one portable
  session IR, alongside Gemini CLI, VS Code Copilot Chat, Cline, and raw
  DeepSeek Harness logs, and imports immutable revisions into governed Chat
  Memory. Its TUI uses an original Library, Review, and Transfer utility flow.
- Selected portable conversations can become deterministic Markdown LLM-Wiki
  assets with source provenance, immutable revisions, and optional agent binding.
- The public benchmark path targets only embedded LongMemory and emits a v2
  K=5 scorecard with auditable quality, retrieval, temporal, reliability,
  efficiency, and explicit N/A fields for unsupported or unpriced metrics.
- Associative benchmark hits include compact diffusion diagnostics. The matrix
  retrieval redesign treats entity identity as a constraint, calibrates and
  whitens feature columns, sparsifies typed-graph seeds, and selects evidence
  sets under token and aspect-coverage constraints.
- The npm CLI entry canonicalizes junction/symlink paths; the VS Code extension
  activates at startup and exposes a persistent bottom-right memory manager.
- n8n uses a native community node package. OpenClaw uses a schema-valid Agent
  Plugins bundle with MCP and a memory workflow Skill. Dify, Flowise,
  LangGraph, CrewAI, AutoGen, OpenAI Agents, and PydanticAI use their native MCP
  client surfaces. Runnable local examples launch the installed LongMemory CLI
  over stdio and leave process lifecycle to the framework.
- Release `1.0.0` is test-free by policy: validation uses branding and release
  artifact checks, TypeScript checks, official integration validators, the
  deterministic benchmark smoke gate, dependency audit, production builds,
  live API/MCP smoke checks, and package-content inspection.
- Deployment files cover Docker, Compose, Heroku, Railway, Render,
  DigitalOcean, and a Vercel-hosted dashboard. Stateful API deployments require
  persistent `/data`; Vercel hosts only the dashboard.
- The repository and primary packages use Apache-2.0. The n8n community package
  remains MIT because n8n's strict validator requires it.
