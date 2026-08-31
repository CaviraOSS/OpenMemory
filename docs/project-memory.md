<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : docs/project-memory.md
 usage : documents LongMemory project memory
-->

# Project-wide memory

Project memory gives long-running agents a scoped Hydrograph world for goals, architecture, decisions, requirements, source files, issues, failures, conventions, deployment facts, risks, and working state.

It is not a global document index. Every project is a recursive world subtree with its own permission contract, provenance, bitemporal history, contradictions, source snapshots, and recall policies.

## ProjectWorld

```text
Hydrograph root
└── tenant
    └── organization
        └── project
            ├── repositories
            ├── documents
            ├── issues
            ├── deployments
            ├── decisions
            ├── agent sessions
            ├── architecture
            ├── tasks
            ├── conventions
            ├── failures
            ├── goals
            ├── constraints
            ├── questions
            ├── risks
            ├── references
            ├── skills
            └── assets
```

Each child is a real recursive Hydrograph world. Connector-created repository, document, issue, and communication worlds attach beneath the appropriate project child instead of the global root.

`ProjectWorld` tracks:

- Tenant, organization, and project identity
- Root and category world IDs
- Linked connector summaries and current source refs
- Active goals and constraints
- Current architecture summary
- Current decisions, questions, tasks, conventions, deployments, and risks
- Project memory policy
- Creation/update time

Project summaries are derived views over durable project nodes. On reopen, project events hydrate those views from the project world history.

## Create project memory

```ts
import { createProjectMemory } from "longmemory";

const projects = await createProjectMemory({
  tenant_id: "tenant:cavira",
  organization_id: "CaviraOSS",
  project_id: "longmemory",
  name: "LongMemory",
  description: "Hydrograph memory engine",
  store: "sqlite",
  db_path: "./longmemory.db",
  max_context_tokens: 2_048,
});
```

One manager can host multiple projects over the same engine:

```ts
await projects.createProject({
  tenant_id: "tenant:cavira",
  organization_id: "CaviraOSS",
  project_id: "another-project",
  name: "Another Project",
});
```

Recall always supplies the selected project root world and project permission context. Project A candidates therefore cannot enter Project B recall unless an explicit cross-project link is added in a future policy layer.

## Project contract

`ProjectMemoryContract` controls whether project memory is visible to project agents, users, and teams, and whether it may be used for code generation, planning, debugging, and decisions. It also controls citation and freshness requirements.

The contract maps into the underlying memory contract:

- Project-scoped source permission
- Reasoning/prediction policies
- Source/citation requirements
- Freshness expiry behavior
- Private project visibility

Connector plans linked to a project are rewritten with the project permission. Restricted project memory cannot be recalled without `project_ids: [project_id]`.

## Ingest project events

```ts
await projects.ingestProjectEvent("longmemory", {
  kind: "architecture",
  topic: "api-framework",
  text: "The API uses Fastify",
  source_type: "github",
  external_id: "file:package.json",
  url: "https://github.com/CaviraOSS/LongMemory/blob/abc/package.json",
  repo: "CaviraOSS/LongMemory",
  branch: "main",
  commit: "abc",
  file_path: "package.json",
  checksum: "sha256:...",
});
```

Supported event kinds include architecture, decision, requirement, goal, constraint, task, bug, failure, preference, convention, deployment, risk, question, reference, agent state, code fact, and manual fact.

Source-backed facts become exocortex nodes. Agent guesses and working interpretations use `subjective: true` and become endocortex nodes. Both still pass through contracts, entity resolution, bitemporal validity, and project scoping.

Project updates are immutable revisions. Architecture, decisions, requirements, goals, tasks, conventions, deployments, agent state, and code facts supersede the prior node for the same topic. Independent assertions can set `replace_current: false`; conflicting claims then create executable `contradicts` edges instead of pretending one source is correct.

## Decisions

Decision events preserve:

- What was decided
- Rationale
- Rejected alternatives
- Source and timestamp
- Current/superseded status
- Replacement decision ID

```ts
await projects.ingestProjectEvent("longmemory", {
  kind: "decision",
  topic: "database",
  text: "Use SQLite for local-first persistence",
  rationale: "Zero setup and transactional local storage",
  alternatives_rejected: ["Hosted Postgres"],
  source_type: "architecture_note",
  url: "file:///docs/decisions.md",
});

const decisions = await projects.getProjectDecisions("longmemory");
```

Superseded decisions remain available in `project_historical` recall.

## Tasks and failures

Task memory records status, priority, owner, source URL, and update time:

```ts
await projects.ingestProjectEvent("longmemory", {
  kind: "task",
  topic: "connector-tests",
  text: "Add connector regression tests",
  status: "blocked",
  priority: "high",
  owner: "Alice Chen",
  source_type: "issue",
  url: "https://github.com/CaviraOSS/LongMemory/issues/42",
});

const tasks = await projects.getProjectTasks("longmemory");
```

Bug/failure events preserve failed fixes, root-cause notes, regression risks, and successful follow-up evidence. Debugging recall prioritizes failures, code facts, tasks, and agent working state so another agent does not repeat rejected approaches.

## Link connectors

```ts
import { github_connector } from "longmemory";

const github = new github_connector({
  owner: "CaviraOSS",
  repo: "LongMemory",
  ref: "main",
});

await projects.linkSourceToProject("longmemory", {
  connector_id: "github",
  connector: github,
  label: "CaviraOSS/LongMemory",
  current_ref: "abc123",
});

const report = await projects.syncProjectSource("longmemory", "github", {
  mode: "incremental",
  current_ref: "abc123",
});
```

Before application, every connector plan is namespaced with the project ID. Top-level source worlds attach under the project repository, document, issue, or deployment world. Node IDs, plan keys, edge keys, permissions, provenance, and metadata are project-scoped. The same external connector can therefore be linked to multiple projects without collisions or leakage.

Connector cursors and checksums provide incremental sync. The project records linked source refs and sync reports. Use `setProjectSourceRef` when a repository branch/commit advances.

## Code memory and freshness

Code facts may include:

- Repository
- Branch
- Commit
- File path
- Line range
- Checksum/version
- Source URL

```ts
await projects.ingestProjectEvent("longmemory", {
  kind: "code_fact",
  topic: "src/core/project/project_memory.ts",
  text: "createProjectMemory is implemented here",
  source_type: "github",
  repo: "CaviraOSS/LongMemory",
  branch: "main",
  commit: "abc123",
  file_path: "src/core/project/project_memory.ts",
  line_start: 1,
  line_end: 400,
  checksum: "sha256:...",
});
```

`project_code` recall compares each fact’s commit with the linked source’s current ref. A mismatch receives a `0.2` freshness score and is ranked behind current-ref facts. Stale code facts remain historically explainable but should not be treated as current truth.

## Project recall modes

```ts
const current = await projects.recallProject(
  "longmemory",
  { text: "current architecture" },
  "project_strict",
);

const old = await projects.recallProject(
  "longmemory",
  {
    text: "database architecture",
    valid_time: Date.UTC(2026, 0, 1),
  },
  "project_historical",
);
```

Modes:

- `project_strict`: current project truth after temporal, contradiction, contract, permission, and grounding gates
- `project_historical`: past valid/recorded project views and supersession chains
- `project_associative`: broad project patterns, including failed attempts and superseded context
- `project_code`: source/code memories with commit freshness ranking
- `project_planning`: goals, architecture, decisions, requirements, constraints, tasks, risks, questions, and agent state
- `project_debugging`: bugs, failures, code facts, tasks, and previous agent attempts

Every result includes project ID, memories, code facts when relevant, contradiction warnings, citations, raw core recall output, and a debug trace.

## Contradictions

Independent sources that disagree create executable `contradicts` edges. Project recall and context packets surface warnings containing both memory IDs and available source text.

For example, a document claiming SQLite and an issue claiming Postgres remain an unresolved conflict. Strict recall will not invent certainty. A later authoritative decision can supersede the old architecture while retaining the contradiction and decision history.

## Agent handoff

Agent state events remember:

- Last active task
- Current plan
- Pending questions
- Files touched
- Proposed changes
- Rejected approaches
- Test results
- Known failures
- Next actions

```ts
await projects.ingestProjectEvent("longmemory", {
  kind: "agent_state",
  topic: "Implement project memory",
  text: "Agent is implementing project memory",
  subjective: true,
  files_touched: ["src/core/project/project_memory.ts"],
  alternatives_rejected: ["Global unscoped memory"],
  next_actions: ["Run project acceptance tests"],
  metadata: {
    current_plan: ["Implement APIs", "Validate isolation"],
    known_failures: ["Cursor overwrite regression"],
    test_results: ["Connector tests passed"],
  },
});
```

The next agent requests a context packet:

```ts
const handoff = await projects.getProjectContext(
  "longmemory",
  "continue implementing project memory",
  2_048,
);
```

The packet contains project summary, current goal, hard constraints, relevant architecture/files, active decisions, open tasks, known failures, retrieved memories, contradictions, citations, suggested next steps, and a debug trace.

It also contains the governed `asset_loadout`: only approved, unexpired,
authorized assets selected for the user/team/role/agent/task/framework identity.
Every selected item includes its injection mode and MCP-style audience, priority,
and last-modified annotations; exclusions include a machine-readable reason.

Memory content is packed under the requested token budget using the same token estimator as core recall. Lower-ranked memories are omitted rather than truncating source identity or citation metadata.

## Reusable Skills and agent loadouts

Skills turn proven workflows into durable project assets with a stable Skill ID,
immutable versions, trigger boundaries, ordered instructions, validation rules,
resource references, ownership metadata, and agent bindings.

```ts
const skill = await projects.createSkill("longmemory", {
  name: "Release check",
  description: "Validate a release before publishing.",
  triggers: ["release checklist", "publish package"],
  instructions: ["Run tests", "Build packages", "Inspect package contents"],
  validation: ["All tests pass"],
  resources: [{ path: "README.md" }],
});

await projects.bindSkill("longmemory", skill.skill_id, ["reviewer"]);
const matches = await projects.matchSkills(
  "longmemory",
  "run the release checklist",
  "reviewer",
);
```

Creating a Skill with an existing `skill_id` creates a superseding version;
prior versions remain historically explainable. Archiving also creates an
immutable terminal version. Project context includes matching Skills within the
same token budget as memories. Skill records inherit the project permission
contract; agent bindings narrow automatic loadout injection.

## CodeGraph queries

Repository connectors already persist file snapshots, symbols, imports, and
source provenance. Source analysis now records bounded symbol bodies and called
symbols, enabling project-scoped search, callers, callees, and reverse impact
paths without a second index service:

```ts
await projects.searchCodeSymbols("longmemory", "createMemory");
await projects.getCodeCallers("longmemory", "createMemory");
await projects.getCodeCallees("longmemory", "createMemory");
await projects.getCodeImpact("longmemory", "createMemory", 5);
```

Results retain file, line, language, commit, and backing memory IDs. The graph
is syntactic and snapshot-aware; dynamic dispatch and runtime reflection remain
outside its evidence boundary.

## Past agent sessions

Cold-start import accepts a provider-neutral session with ordered system, user,
assistant, and tool messages. It validates all messages and monotonic timestamps
before writing, then stores each raw turn in the `agent_sessions` world with the
original provider, agent, role, sequence, timestamp, tool call, and source ref.

```ts
await projects.importSession("longmemory", {
  session_id: "codex-42",
  agent_id: "builder",
  provider: "codex",
  source_ref: "history/codex-42.json",
  messages: [
    { role: "user", content: "Implement project Skills.", at: 1 },
    { role: "assistant", content: "Skills implemented.", at: 2 },
  ],
});
```

## Required APIs

```ts
const projects = await createProjectMemory(config);

await projects.linkSourceToProject(project_id, source);
await projects.ingestProjectEvent(project_id, event);
await projects.syncProjectSource(project_id, connector_id);
await projects.recallProject(project_id, query, mode);
await projects.getProjectContext(project_id, task);
await projects.getProjectDecisions(project_id);
await projects.getProjectTasks(project_id);
await projects.createSkill(project_id, skill);
await projects.matchSkills(project_id, query, agent_id);
await projects.searchCodeSymbols(project_id, query);
await projects.getCodeImpact(project_id, symbol);
await projects.importSession(project_id, session);
await projects.listSessions(project_id);
await projects.registerAsset(project_id, asset);
await projects.governAsset(project_id, asset_id, patch);
await projects.resolveAssetLoadout(project_id, request);
await projects.buildAgentManifest(project_id, request);
await projects.explainProjectMemory(project_id, memory_id);
```

Equivalent exported helper functions accept the project manager as their first argument.

Project memory never becomes global by default, never writes raw chunks into vector storage, never skips provenance, and never admits stale code facts as current project truth.
