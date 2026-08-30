<!--
     __                      __  ___                               
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ / 
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /  
                     /____/                                 /____/   

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : apps/vscode-extension/README.md
 usage : supports the LongMemory VS Code extension readme
-->

# LongMemory for VS Code

Native Hydrograph memory workflows backed by the local LongMemory CLI.

## Features

- Browse recent project memories in the activity bar.
- Remember selected text or a quick note.
- Recall context and build project coding briefs.
- Include task-matched reusable Skills and validation steps in project briefs.
- Resolve approved Chat Memory, Skill, LLM-Wiki, and CodeGraph assets for the
  configured agent/framework and show the equipped loadout in project briefs.
- Explain and reinforce individual memories.
- Run bounded decay maintenance explicitly.
- Record reviewed code patches from Copilot, Codex, Claude, Cursor, Windsurf,
  and other coding agents as durable project memories.
- Manage workspace memory from an always-visible bottom-right status item.
- Import selected Claude Code, Codex, OpenCode, Gemini CLI, VS Code Copilot
  Chat, Cline, or raw DeepSeek Harness sessions from the manager.

## AI change memory

VS Code's stable API reports document changes, but it does not identify which
extension produced an edit. LongMemory keeps that attribution boundary honest:

- **Start AI Change Session** creates a user-declared, high-confidence session
  for a selected agent. It takes a bounded in-memory workspace baseline and
  watches both open editors and direct file writes until **Stop AI Change
  Session** is run.
- Explicit sessions are recorded on stop by default. Disable
  `longmemory.agentChanges.autoRecordExplicit` to review each one first.
- Optional heuristic detection is off by default. When enabled, it queues
  low-confidence editor changes if a known AI extension is installed. Those
  candidates are never recorded without review.

LongMemory stores a compact before/after patch, file list, agent label,
attribution confidence, timestamps, and a stable change ID. It never persists
the temporary workspace baseline. Credential-like lines are redacted;
environment, key, credential, binary, generated, dependency, database, and
LongMemory paths are excluded. Document, session, and final patch byte limits
are configurable. A user edit made during an explicit session is part of that
session, so start and stop sessions around one agent task.

## Setup

1. Install the `longmemory` CLI or set `longmemory.cliPath` to its executable or built JavaScript entry.
2. Open a workspace.
3. Run **LongMemory: Initialize Workspace Memory**.
4. Use the LongMemory activity-bar view or command palette.

The bottom-right **Memory** item opens the native manager for recall, notes,
project context, session imports, AI change recording/review, initialization,
settings, and output. A separate recording/diff item appears only while an AI
change session is active or candidates are waiting.

The default database is `.longmemory/project.db` in the workspace. All operations use stable machine-readable CLI output, so the extension and terminal share the same engine and gates.

The extension requires Workspace Trust before it executes the CLI or writes
memory. AI change tracking is local to the current workspace and follows the
same project scope as all other extension commands.

Set `longmemory.agentId` and `longmemory.framework` to resolve the same governed
loadout used by CLI and MCP agents. Empty `agentId` keeps project context generic;
the default framework is `vscode`.

## Development

Open `apps/vscode-extension` as a VS Code folder, run `pnpm install`, and press
F5 with **Run LongMemory Extension**. For this monorepo, build the root package
and set the Extension Development Host setting `longmemory.cliPath` to the
absolute root `dist/cli/index.js` path.
