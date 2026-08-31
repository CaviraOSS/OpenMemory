<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : docs/agent-assets.md
 usage : documents LongMemory agent assets
-->

# Governed agent memory assets

LongMemory turns agent work into four reusable project assets without creating a
second memory engine:

| Input                     | Asset         | Initial state | Typical use                                        |
| ------------------------- | ------------- | ------------- | -------------------------------------------------- |
| Imported conversations    | `chat_memory` | `candidate`   | Session continuity and prior decisions             |
| Curated procedures        | `skill`       | `approved`    | Direct instructions and validation rules           |
| Document connector sync   | `llm_wiki`    | `candidate`   | Structured pages, citations, and project knowledge |
| Repository connector sync | `code_graph`  | `candidate`   | Symbols, callers, callees, and impact analysis     |

Candidates require an explicit governance update before they can enter an agent
loadout. Manually authored Skills are approved because the author supplied their
trigger, instructions, validation, and resources explicitly.

## Asset model

Every asset has a stable ID and immutable versions. A version records:

- Type, name, description, owner, source, and readable `content_ref`
- Lifecycle: `draft`, `candidate`, `approved`, `deprecated`, `archived`, or `failed`
- Visibility: `private`, `project`, `team`, `restricted`, `agent`, or `task`
- Deny-first ACL entries for users, teams, roles, agents, tasks, and frameworks
- Bindings to agents, tasks, or frameworks
- Injection mode: `direct`, `summary`, `tool`, or `reference`
- Priority, confidence, expiry, labels, payload, and provenance metadata

Lifecycle transitions are validated. Content and policy changes create a new
version rather than rewriting history. Visibility grants only `read` and `use`;
`manage`, `assign`, and `share` require ownership or an explicit ACL.

## Loadout assembly

```ts
const loadout = await projects.resolveAssetLoadout("longmemory", {
  query: "review the release architecture",
  user_id: "alice",
  team_ids: ["core"],
  roles: ["developer"],
  agent_id: "reviewer",
  task_id: "release-42",
  framework: "codex",
  token_budget: 2_048,
});
```

Resolution is deterministic and explainable:

1. Filter by requested type, approved state, expiry, and deny-first access.
2. Match enabled agent/task/framework bindings.
3. Reject assets bound to another target.
4. Rank required bindings, priority, query relevance, and confidence.
5. Pack structured context under the token budget.
6. Return every exclusion with a reason.

Selected items include MCP-compatible assistant audience, priority, and last
modified annotations. Tool/reference modes keep large Wiki and CodeGraph assets
out of the prompt until an agent actually needs them.

## Portable agent manifest

```ts
const manifest = await projects.buildAgentManifest("longmemory", {
  agent_id: "reviewer",
  framework: "codex",
  query: "review the release",
  user_id: "alice",
  interface_url: "https://agents.example.com/a2a",
});
```

The versioned manifest includes the authorized loadout, MCP discovery URIs, and
the LongMemory extension URI
`https://longmemory.dev/extensions/memory-assets/v1`. When an interface URL is
provided it also emits an A2A 1.0-compatible Agent Card containing only the
approved Skill capabilities visible to that identity. This is a discovery
artifact; LongMemory does not claim to implement the full A2A task protocol.

## CLI

```powershell
longmemory asset list
longmemory asset register --type llm_wiki --name "Architecture wiki" `
  --description "Project architecture" --owner alice --source-type docs `
  --content-ref longmemory://project/current/wiki --status candidate
longmemory asset govern <asset-id> --status approved `
  --agents reviewer --mode tool --priority 0.8
longmemory asset loadout "review architecture" --agent reviewer --framework codex
longmemory agent manifest reviewer --framework codex --query "review architecture"
```

For complete ACLs, bindings, payload, and metadata, use `--input-json` or
`--patch-json`.

## MCP

- `longmemory_asset_catalog`: list/get governed assets or resolve a loadout
- `longmemory_manage_asset`: register or govern an asset; blocked in read-only mode
- `longmemory://project/{project_id}/assets`: identity-filtered catalog
- `longmemory://project/{project_id}/asset/{asset_id}`: one authorized asset
- `longmemory://project/{project_id}/agent/{agent_id}/manifest`: portable manifest

MCP identity is fixed by runtime configuration. Tool arguments cannot impersonate
another agent or framework. Tool calls are schema-validated and audited.

## Design references

The implementation incorporates current ecosystem guidance:

- [MCP resources](https://modelcontextprotocol.io/specification/2025-06-18/server/resources): application-driven discovery, URI templates, subscriptions, audience/priority/last-modified annotations, and per-resource access checks.
- [MCP tools](https://modelcontextprotocol.io/specification/2025-06-18/server/tools): strict input validation, access control, sanitization, timeouts, auditing, and human control for sensitive actions.
- [MCP authorization](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization): resource-bound credentials, audience validation, and no token passthrough.
- [A2A 1.0](https://a2a-protocol.org/latest/specification/): Agent Cards, capability/Skill discovery, authenticated extended cards, versioned extensions, task/context identity, and authorization scoping.
- [OpenAI Agents sessions](https://openai.github.io/openai-agents-python/sessions/): stable session IDs, selective history inclusion, bounded retrieval, shared sessions, and explicit compaction concurrency boundaries.
- [TencentDB Agent Memory](https://github.com/TencentCloud/TencentDB-Agent-Memory): the four-asset product model, human governance, fixed agent bindings, and direct/summary/tool/reference injection modes.
