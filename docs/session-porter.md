<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : docs/session-porter.md
 usage : documents LongMemory session porter
-->

# Coding-harness session porter

LongMemory provides a terminal-first workflow for discovering and importing local
AI terminal and code-editor conversations into governed Chat Memory. Supported
sources are Claude Code, Codex, OpenCode, Gemini CLI, VS Code Copilot Chat,
Cline, and DeepSeek Harness raw session logs.

```text
Coding harness stores -> portable session IR -> LongMemory project -> Chat Memory asset
```

Source adapters are read-only. LongMemory never writes proprietary harness or
editor session stores. Imported context becomes a durable project
asset that any configured agent or framework can access through CLI, MCP, VS
Code, or the portable agent manifest.

## Interactive transfer utility

```powershell
longmemory tui
```

The native terminal utility uses an original three-phase flow:

1. **Library** detects readable local archives and confirms the current workspace.
2. **Review** previews conversations by workspace and recent activity for selection.
3. **Transfer** imports immutable revisions, reports progress, and presents a receipt.

The interface is styled as a compact desktop utility with a persistent phase
rail. It intentionally does not reproduce another porter's screen sequence,
labels, branding, or interaction choreography.

Selection accepts `all`, comma-separated rows such as `1,3,5`, and ranges such
as `2-6`.

## Headless commands

```powershell
longmemory detect
longmemory session discover --from claude-code
longmemory port --from claude-code --to longmemory --all
longmemory port --from codex --to longmemory --id <session-id> --agent builder
longmemory verify --from opencode --sample 10
longmemory session wiki --from gemini-cli --all --name "Project decisions"
longmemory session wiki --from copilot-chat --id <session-id> --agent reviewer --status approved
```

`port` accepts exactly one source harness and the `longmemory` destination. Use
`--all` or repeat `--id`. `--force` creates a new asset version even when the
source revision is unchanged.

Normal non-interactive output remains one JSON document. Use `--jsonl` to emit
progress events followed by a summary record:

```powershell
longmemory port --from codex --to longmemory --all --jsonl
```

## AI Wiki conversion

`session wiki` converts selected conversations into a governed `llm_wiki`
asset. The Markdown contains an index, source and workspace provenance, stable
timestamps, and normalized user/agent sections. The transformation is
deterministic and does not invent model-generated summaries or claims.

The first conversion creates the asset, unchanged source history is skipped,
and changed conversations create a new immutable asset version. Use `--agent`
to add a direct agent binding. Wiki assets default to `candidate`; pass
`--status approved` only when the conversation set has been reviewed.

## Detection and overrides

| Harness              | Default source                                                                     | Override                                                     |
| -------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Claude Code          | `~/.claude/projects`                                                               | `LONGMEMORY_CLAUDE_PROJECTS`                                 |
| Codex                | `$CODEX_HOME/sessions` or `~/.codex/sessions`                                      | `LONGMEMORY_CODEX_SESSIONS`                                  |
| OpenCode             | `$XDG_DATA_HOME/opencode/opencode.db`                                              | `OPENCODE_DB`                                                |
| Gemini CLI           | `~/.gemini/tmp/*/chats/session-*.json[l]`                                          | `LONGMEMORY_GEMINI_SESSIONS`                                 |
| VS Code Copilot Chat | VS Code-compatible `User/workspaceStorage/*/chatSessions`                          | `LONGMEMORY_COPILOT_CHAT_SESSIONS`                           |
| Cline                | VS Code-compatible `User/globalStorage/{saoudrizwan.claude-dev,cline.cline}/tasks` | `LONGMEMORY_CLINE_TASKS`                                     |
| DeepSeek Harness     | `$DSH_HOME/sessions` or `~/.dsh/sessions`                                          | `LONGMEMORY_DEEPSEEK_HARNESS_SESSIONS` or `DSH_SESSION_ROOT` |

VS Code-compatible roots are resolved per platform:

- Windows: `%APPDATA%/{Code,Code - Insiders,VSCodium,Cursor}/User`
- macOS: `~/Library/Application Support/{Code,Code - Insiders,VSCodium,Cursor}/User`
- Linux: `${XDG_CONFIG_HOME:-~/.config}/{Code,Code - Insiders,VSCodium,Cursor}/User`

Detection is read-only and never throws for an absent harness. OpenCode parsing
uses its native `opencode export` command when available and a read-only SQLite
fallback otherwise. DeepSeek Harness stores concatenated Zstandard frames by
default. LongMemory detects those roots but currently imports only raw
`compression: none` JSONL or a raw export; it reports compressed roots as
unavailable instead of partially decoding or silently dropping events.

## Portable session model

Every adapter maps into one provider-neutral representation:

- Native source harness and session ID
- Source path and authoritative working directory
- Clean preview title
- Created and updated timestamps
- Ordered system, user, assistant, and tool text turns
- Assistant model provenance
- Count of unsupported tool/thinking blocks
- Lossless source metadata and malformed-line diagnostics

Injected wrappers and terminal ANSI noise are removed from previews, not from
stored raw turns.

## Idempotency and revisions

The stable Chat Memory asset ID derives from `(source harness, native session
ID)`. A content revision covers the title, project path, ordered turns, and drop
count.

- First revision: `created`
- Same revision: `skipped`
- Changed or grown source: `updated` in place as a new immutable asset version
- `--force`: creates a policy version even when content is unchanged
- Archived destination asset: rejected

Raw session revisions remain immutable. The stable governed asset points at the
latest imported revision and retains source revision, path, project, drop count,
and parser diagnostics.

## Fidelity and verification

```powershell
longmemory verify --from codex --sample 25
```

Verification discovers and parses a bounded sample without writing any database.
Malformed sessions are reported independently. The importer preserves portable
text turns and counts unsupported structured blocks; it does not claim lossless
portability for hidden reasoning or proprietary UI state.

## Why LongMemory is the destination

Direct cross-writing harness stores couples a memory system to unstable private
formats and risks corrupting active sessions. LongMemory instead provides a
stable shared destination with immutable provenance, project isolation,
visibility and ACL governance, agent/framework bindings, and explainable
loadouts. Harnesses consume the resulting context through supported LongMemory
interfaces rather than editing one another's stores.
