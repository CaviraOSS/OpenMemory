<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : docs/cli.md
 usage : documents LongMemory cli
-->

# Command-line interface

The `longmemory` CLI is a local SQLite interface to the same `createMemory` Hydrograph engine used by the package API and self-hosted server.

```bash
pnpm build
longmemory help --pretty
```

During repository development, replace `longmemory` with
`node --import tsx src/cli/index.ts`.

## Output and automation

Every finite command writes exactly one JSON document to stdout. Add `--pretty` for indented JSON. Errors are JSON on stderr and return a nonzero exit status.

When stderr is an interactive terminal, LongMemory displays its colored ASCII control-plane banner there. The banner never contaminates stdout and is automatically suppressed for pipes and subprocess capture. Set `NO_COLOR=1`, `TERM=dumb`, or use `--no-color` to disable ANSI color.

This behavior follows the automation conventions exposed by both terminal coding agents:

- [Codex CLI](https://learn.chatgpt.com/docs/developer-commands?surface=cli) separates non-interactive execution and machine-readable output from its TUI.
- [Claude Code CLI](https://code.claude.com/docs/en/cli-reference) exposes print mode and JSON output for scripted calls.

LongMemory commands never prompt. This makes them safe to invoke from Codex, Claude Code, CI, shell pipelines, and MCP tools:

```bash
longmemory recall --user u1 --query "what do I prefer" --mode strict --db ./memory.db \
  | jq '.items[0].node.content.raw'
```

The single exception is the explicitly interactive `longmemory tui` wizard.
It refuses to run without a TTY. Every headless porter operation has a direct
command equivalent.

## Global options

| Option        | Description                                  |
| ------------- | -------------------------------------------- |
| `--db <path>` | SQLite database path                         |
| `--pretty`    | Indent JSON output                           |
| `--jsonl`     | Stream progress records, then a summary      |
| `--no-color`  | Disable ANSI color in the interactive banner |
| `--help`      | Print command help as JSON                   |

The database path resolves in this order: `--db`, `LONGMEMORY_DB_PATH`, then `./longmemory.db`. All stateful commands use SQLite.

Times accept epoch milliseconds or an ISO date such as `2026-03-01T00:00:00Z`.

## Session porter

```bash
longmemory tui
longmemory detect
longmemory session discover --from claude-code --limit 100
longmemory port --from claude-code --to longmemory --all
longmemory port --from codex --to longmemory --id <session-id> --force
longmemory verify --from opencode --sample 10
```

The porter uses read-only Claude Code, Codex, and OpenCode adapters and one
portable session representation. It imports into the selected LongMemory project
as governed Chat Memory; it does not mutate proprietary harness stores. Normal
automation gets one JSON result, while `--jsonl` emits progress events. See
[session-porter.md](session-porter.md).

## Serve

```bash
longmemory serve --db ./memory.db
longmemory serve --db ./memory.db --host 0.0.0.0 --port 7331
```

`serve` creates the memory facade directly and injects it into the Phase 20 HTTP transport. It prints one readiness JSON document containing the URL, database path, store, and process ID, then runs until `SIGINT` or `SIGTERM`.

The server also reads the Phase 20 environment settings documented in [api.md](api.md).

## Ingest

```bash
longmemory ingest \
  --db ./memory.db \
  --user u1 \
  --text "I prefer tea" \
  --at 2026-01-01T00:00:00Z \
  --pretty
```

Optional ingest flags are `--world <name>` and `--external`.

## Recall

Strict recall:

```bash
longmemory recall \
  --db ./memory.db \
  --user u1 \
  --query "what do I prefer" \
  --mode strict
```

Historical recall uses the same command:

```bash
longmemory recall \
  --db ./memory.db \
  --user u1 \
  --query "what did I prefer" \
  --mode historical \
  --valid-time 2026-01-01T00:00:01Z
```

`--mode` is required and accepts `strict`, `historical`, `associative`, or `world_grounded`. Optional flags include `--recorded-time`, `--at`, `--world`, and `--k`.

## Explain

```bash
longmemory explain --db ./memory.db --id node_id --pretty
```

The result contains the persisted node, incoming and outgoing executable edges, and an ingest trace when it is available in the current process.

## Worlds

```bash
longmemory worlds --db ./memory.db
longmemory worlds --db ./memory.db --zone endocortex --limit 20
```

## Entities

```bash
longmemory entities --db ./memory.db --query "Alice Chen"
```

The command delegates to conservative entity resolution and returns its merge, candidate, or creation decision. `--at` sets the observation time.

## Timeline

```bash
longmemory timeline \
  --db ./memory.db \
  --entity entity_id \
  --valid-time 2026-01-01T00:00:01Z
```

The CLI resolves the entity ID through the facade and requests its historical timeline by canonical name. `--recorded-time` is also supported.

## Benchmark

```bash
longmemory bench --pretty
```

This runs the benchmark checks shipped inside the published package and exits nonzero when a check fails. The full development harness remains available through `pnpm bench` and `pnpm bench:ci`.

## Reusable Skills

```bash
longmemory skill create \
  --name "Release check" \
  --description "Validate a release" \
  --triggers "release checklist,publish package" \
  --instructions-json '["Run tests","Build packages"]' \
  --validation-json '["Tests pass"]'
longmemory skill bind <skill-id> --agents reviewer
longmemory skill match "run the release checklist" --agent reviewer
longmemory skill list --all
longmemory skill archive <skill-id>
```

Creating with an existing `--id` writes a superseding version. Bindings also
create a version, so loadout changes remain historically explainable.

## Governed memory assets

```bash
longmemory asset list
longmemory asset register \
  --type llm_wiki \
  --name "Architecture wiki" \
  --description "Project architecture" \
  --owner alice \
  --source-type docs \
  --content-ref longmemory://project/current/wiki \
  --status candidate
longmemory asset govern <asset-id> --status approved \
  --agents reviewer --mode tool --priority 0.8
longmemory asset loadout "review architecture" \
  --agent reviewer --framework codex
longmemory agent manifest reviewer --framework codex \
  --query "review architecture"
```

Conversation imports, Skills, document sync, and repository sync automatically
register Chat Memory, Skill, LLM-Wiki, and CodeGraph assets. Inferred/imported
assets begin as candidates; curated Skills begin approved. Use `--input-json`
and `--patch-json` for complete ACL, binding, payload, and metadata contracts.
See [agent-assets.md](agent-assets.md).

## CodeGraph

```bash
longmemory code search createMemory
longmemory code callers createMemory
longmemory code callees createMemory
longmemory code impact createMemory --depth 5
```

Queries use code symbols and call relations persisted by repository connector
sync. Output includes file/line, language, commit, and backing memory identity.

## Past agent sessions

```bash
longmemory session import ./history/codex-42.json
longmemory session list
```

The input is a JSON object containing `session_id`, `agent_id`, `provider`, and
`messages`. Each message has `role`, `content`, and an optional epoch-millisecond
`at`, `name`, and `tool_call_id`. Imports validate all content and monotonic
timestamps before writing. Session IDs are unique within a project.

## Migrate

```bash
longmemory migrate \
  --from ./old.db \
  --to ./new.db \
  --report ./migration-report.json \
  --pretty
```

Migration reads legacy SQLite, JSON, or JSONL memory; skips corrupt and duplicate records; maps useful records through `createMemory`; restores supported relations; and runs an integrity/hydration benchmark against the destination. Current Hydrograph databases use SQLite online backup. The command refuses to overwrite a destination or migrate a database onto itself.

The detailed audit is returned on stdout and written to `--report`, or `<destination>.migration-report.json` by default. See [migration.md](migration.md) for supported fields, mapping rules, and report semantics.

## Agent examples

Codex non-interactive task:

```bash
codex exec --json 'Run longmemory recall --user u1 --query "current preference" --mode strict --db ./memory.db and summarize the JSON result.'
```

Claude Code print-mode task:

```bash
claude -p --output-format json 'Run longmemory worlds --db ./memory.db and identify the active endocortex worlds.'
```
