# OpenMemory Hydrograph

OpenMemory is a single TypeScript npm package for durable cognitive memory. The
same Hydrograph engine powers library imports, the CLI, and the self-hosted HTTP
server.

## Install

```powershell
pnpm add openmemory
```

## In-memory usage

No database or setup is required.

```ts
import { createMemory } from "openmemory";

const memory = await createMemory();

const preference = await memory.ingest({
  user_id: "user:alice",
  text: "I prefer tea",
  at: Date.now(),
});

const current = await memory.recall({
  text: "what do I prefer",
  mode: "strict",
});

const explanation = await memory.explain(preference.node.id);
console.log(current, explanation);

await memory.close();
```

## SQLite usage

```ts
import { createMemory } from "openmemory";

const memory = await createMemory({
  store: "sqlite",
  db_path: "./openmemory.db",
  tenant_id: "tenant:default",
  user_id: "user:alice",
  enable_cold_log: true,
  enable_consolidation: true,
});

await memory.ingest({
  user_id: "user:alice",
  text: "I now prefer coffee instead of tea",
});

await memory.close();
```

Reopening the same `db_path`, `tenant_id`, and `user_id` restores nodes, edges,
worlds, entities, grounded facts, and sketch state.

## Recall modes

```ts
const strict = await memory.recall({
  text: "what is my current preference",
  mode: "strict",
});

const historical = await memory.recall({
  text: "what did I prefer",
  mode: "historical",
  valid_time: Date.UTC(2026, 0, 1),
});

const associative = await memory.recall({
  text: "memories related to rainy offices",
  mode: "associative",
});

const grounded = await memory.recall({
  text: "where is the production server",
  mode: "world_grounded",
});
```

Strict recall applies temporal, contract, contradiction, confidence, and
grounding gates before ranking. Historical recall preserves superseded truth.
Associative recall supports emotional and pattern continuity. World-grounded
recall requires current external evidence.

## Public API

```ts
await memory.ingest(event);
await memory.recall(query);
await memory.explain(memory_id);
await memory.getWorld(world_id);
await memory.listWorlds({ zone: "endocortex" });
await memory.getEntity(entity_id);
await memory.resolveEntity(entity_mention);
await memory.getTimeline({ valid_time, recorded_time });
await memory.getStats();
await memory.runDecay({ now: Date.now(), limit: 256 });
await memory.reinforce(memory_id, { at: Date.now() });
await memory.close();
```

## Configuration

```ts
const memory = await createMemory({
  store: "memory",
  db_path: "./openmemory.db",
  embedding_provider: {
    embed: async (text) => embedding_model.embed(text),
  },
  default_world: "memory",
  max_context_tokens: 2048,
  strict_confidence_threshold: 0.5,
  grounding_threshold: 0.6,
  enable_cold_log: false,
  enable_consolidation: false,
  benchmark_mode: false,
  decay_policy: {
    hot_lambda: 0.005,
    warm_lambda: 0.02,
    cold_lambda: 0.05,
    activation_floor: 0.05,
    reinforcement_gain: 0.2,
  },
});
```

Defaults use an in-memory store, a `memory` world, a 2,048-token context budget,
`0.5` strict confidence, and `0.6` grounding threshold.

## Memory decay

Associative recall projects age-sensitive activation without mutating memory.
Applications can persist that projection through deterministic, cursor-based
`runDecay()` cycles and explicitly reinforce useful memories with diminishing
returns through `reinforce()`. Decay updates only the mutable activation
envelope: content, vectors, provenance, valid-time history, and content hashes
remain unchanged. Default hot, warm, and cold rates are `0.005`, `0.02`, and
`0.05` per day, adjusted by retention, confidence, grounding, conflict, and
reinforcement. `runDecay()` processes at most 256 nodes by default and returns a
`next_cursor` for the following batch. Cycles are idempotent at the same
timestamp and audited when using SQLite. OpenMemory does not start a hidden
maintenance timer. Decay-aware associative ranking is enabled when
`decay_policy` is supplied; default ranking remains unchanged until an official
quality A/B justifies enabling it globally.

## Real embeddings

The server, CLI, and MCP runtime support OpenAI-compatible, Gemini, AWS Bedrock
Titan, Ollama, local HTTP, Siray, and deterministic synthetic embeddings.
Providers support normalized dimensions, timeout/retry controls, smart/deep
tiers, and ordered fallbacks without bypassing Hydrograph recall gates. See
[docs/embeddings.md](docs/embeddings.md) and [.env.example](.env.example).

## Connectors

```ts
import { createMemory, github_connector, sync_connector } from "openmemory";

const memory = await createMemory({
  store: "sqlite",
  db_path: "./openmemory.db",
});

const github = new github_connector({
  owner: "CaviraOSS",
  repo: "OpenMemory",
});

await github.connect();
const repository = await github.inspectRepository();
const sync = await sync_connector(github, memory, {
  mode: "incremental",
});
```

The unified connector framework includes deep GitHub and local repository
intelligence, native Markdown/web/feed connectors, more than 70 file formats,
and 50 registered code, storage, knowledge, communication, project, web, and
data connectors. Connectors map external versions, permissions, provenance,
worlds, entities, grounding, sections, updates, and deletions into atomic
Hydrograph import plans instead of writing raw chunks. See
[docs/connectors.md](docs/connectors.md).

Native document ingestion extracts PDF pages, DOCX text, HTML/URLs, Markdown,
plain text, audio transcripts, and video audio. Google Drive, Sheets, Slides,
OneDrive, and Notion use provider-native APIs while preserving the same cursor,
permission, provenance, dry-run, and transactional import-plan boundary.

## Project memory

```ts
import { createProjectMemory } from "openmemory";

const projects = await createProjectMemory({
  tenant_id: "tenant:cavira",
  organization_id: "CaviraOSS",
  project_id: "openmemory",
  name: "OpenMemory",
  store: "sqlite",
  db_path: "./openmemory.db",
});

await projects.ingestProjectEvent("openmemory", {
  kind: "decision",
  topic: "persistence",
  text: "Use SQLite for local-first persistence",
  source_type: "architecture_note",
  url: "file:///docs/decisions.md",
});

const handoff = await projects.getProjectContext(
  "openmemory",
  "continue the current task",
);
```

Project memory creates tenant/organization/project world hierarchies, scopes
connector sync and recall, preserves architecture and decision history, ranks
code facts by source snapshot freshness, tracks contradictions, and returns
token-budgeted handoff packets for agents. See
[docs/project-memory.md](docs/project-memory.md).

Conversations, curated procedures, documents, and repositories also become a
governed four-asset catalog: Chat Memory, Skills, LLM-Wiki, and CodeGraph.
Assets have immutable versions, lifecycle approval, owner/team/ACL policy,
agent/task/framework bindings, injection modes, expiry, and explainable
token-budgeted loadouts. Portable manifests expose MCP discovery metadata and an
optional A2A 1.0-compatible Agent Card. See
[docs/agent-assets.md](docs/agent-assets.md).

## MCP integration

Run OpenMemory as a local stdio MCP server for coding and IDE agents:

```powershell
openmemory mcp --db .openmemory/project.db --project current
```

Or expose Streamable HTTP beside the self-hosted API:

```powershell
openmemory serve --db ./openmemory.db --mcp-http
```

MCP provides thirteen high-level tools, thirteen readable resources, and five agent
workflow prompts. Project/user permissions, recall gates, token budgets,
read-only mode, connector dry-runs, and JSONL audit logging are enforced by the
shared runtime. See [docs/mcp.md](docs/mcp.md).

## Dashboard

The optional Next.js dashboard under [dashboard](dashboard) provides live
Hydrograph health, immutable memory browsing/ingest, strict search, project
selection, activity timelines, decay views, settings status, and memory-aware
chat. It is responsive on mobile and desktop and talks to the root server
through a same-origin compatibility proxy. See
[dashboard/README.md](dashboard/README.md).

## VS Code extension

The native extension under [apps/vscode-extension](apps/vscode-extension)
provides an activity-bar memory browser, status bar, selection/note ingestion,
recall, project context, explanation, reinforcement, and explicit decay
maintenance. Explicit AI change sessions capture bounded, redacted patches from
Copilot, Codex, Claude, Cursor, Windsurf, and other coding agents, including
direct workspace writes. Because VS Code does not expose edit-origin identity,
automatic heuristic candidates are opt-in, marked low-confidence, and always
reviewed before ingestion. It talks to the same local engine through stable CLI
JSON rather than maintaining a second client implementation.

```powershell
pnpm extension:check
pnpm extension:build
pnpm extension:package
```

Set `openmemory.cliPath` to the installed `openmemory` binary. For development,
build the root package and point it at `dist/cli/index.js`.

## Multilingual memory

```ts
const memory = await createMemory({
  output_language: "en",
  enable_translation: false,
});

await memory.ingest({
  user_id: "user:alice",
  text: "मुझे TypeScript पसंद है backend के लिए.",
});

const result = await memory.recallMultilingual({
  text: "What language does the user prefer for backend?",
  mode: "strict",
  token_budget: 256,
});
```

OpenMemory preserves original wording/script, detects code switching, tokenizes
Indic/Arabic/CJK text, supports conservative cross-script entity aliases, and
uses multilingual embeddings for cross-language ranking. Translation is an
optional provenance-marked display view, never hidden source truth. See
[docs/multilingual.md](docs/multilingual.md).

## CLI and server

```powershell
openmemory init
openmemory tui
openmemory detect
openmemory session discover --from claude-code
openmemory port --from claude-code --to openmemory --all
openmemory verify --from codex --sample 10
openmemory session wiki --from gemini-cli --all --name "Project knowledge"
openmemory status
openmemory status --memories 20 --json
openmemory ingest "Remember the rollback procedure" --type procedure
Get-Content .\notes.md | openmemory ingest --stdin --source notes.md
openmemory recall "what is the rollback procedure" --mode associative
openmemory memory list --limit 50
openmemory maintenance decay --all
openmemory maintenance reinforce <memory-id>
openmemory project context "prepare the next release"
openmemory skill create --name "Release check" --description "Validate releases" --triggers "release checklist" --instructions-json '["Run tests","Build packages"]'
openmemory skill match "run the release checklist" --agent reviewer
openmemory asset list
openmemory asset loadout "prepare the release" --agent reviewer --framework codex
openmemory agent manifest reviewer --framework codex --query "prepare the release"
openmemory code impact createMemory
openmemory session import ./history/codex-session.json
openmemory agent preflight "prepare the next release" --json
openmemory serve --mcp-http
```

The CLI defaults to `.openmemory/project.db` in the detected workspace and
emits stable JSON whenever stdout is not a TTY or `--json` is supplied. Use
`--db`, `--project`, `--user`, and `--cwd` to override scope. Commands never
prompt unless `--interactive` is explicitly enabled. `memory list`, status
snapshots, and stdin ingestion are the stable native-client contract used by
the VS Code extension.

The session porter detects local Claude Code, Codex, and OpenCode history and
imports selected conversations as governed Chat Memory. Source adapters are
read-only; unchanged native sessions skip, changed sessions create immutable
asset versions, and `--jsonl` exposes progress for automation. See
[docs/session-porter.md](docs/session-porter.md).

## Development

```powershell
pnpm build
pnpm test
pnpm bench
pnpm typecheck
pnpm release:check
```

OpenMemory itself is the SDK; there is no separate SDK package.
