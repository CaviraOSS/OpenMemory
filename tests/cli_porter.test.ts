import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { clean_turn_preview, derive_session_preview, group_sessions_by_project } from '../src/cli/porter/preview.js';
import type { portable_session } from '../src/cli/porter/types.js';
import { detect_harnesses, get_import_adapter } from '../src/cli/porter/detect.js';
import Database from 'better-sqlite3';
import { createProjectMemory } from '../src/index.js';
import { parse_failure_outcome, port_sessions } from '../src/cli/porter/orchestrator.js';
import { display_timestamp, display_workspace, parse_session_selection } from '../src/cli/commands/porter/tui.js';
import { is_cli_main } from '../src/cli/main.js';
import { resolve_cli_argv } from '../src/cli/cli_app.js';
import { create_colors } from '../src/cli/theme/colors.js';
import { utility_window } from '../src/cli/output/utility_window.js';
import { panel } from '../src/cli/output/panel.js';
import { render_session_wiki, sessions_to_wiki } from '../src/cli/porter/wiki.js';
import { editor_storage_roots } from '../src/cli/porter/adapters/shared.js';

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

const session = (id: string, cwd: string, updated_at: number): portable_session => ({
    schema_version: '1.0.0', source_harness: 'codex', source_session_id: id, source_path: id, cwd, title: id,
    updated_at, turns: [{ role: 'user', text: id, timestamp: updated_at }], dropped_turns: 0, source_metadata: {},
});

describe('CLI session porter', () => {
    it('cleans harness wrappers and derives useful previews', () => {
        expect(clean_turn_preview('<system_instruction>injected</system_instruction>')).toBe('');
        expect(derive_session_preview(['<command-name>/plan</command-name>', 'Implement the memory porter'])).toBe('/plan · Implement the memory porter');
        expect(parse_session_selection('1, 3-4', 5)).toEqual([0, 2, 3]);
        expect(parse_session_selection('all', 3)).toEqual([0, 1, 2]);
        expect(display_workspace('C:\\Users\\dev\\openmemory')).toBe('openmemory');
        expect(display_workspace('/Users/dev/project')).toBe('project');
        expect(display_timestamp(Date.parse('2026-08-20T12:34:56Z'))).toBe('2026-08-20 12:34');
        expect(is_cli_main(import.meta.filename, import.meta.filename)).toBe(true);
        expect(is_cli_main(import.meta.filename, join(import.meta.dirname, 'other.ts'))).toBe(false);
        expect(resolve_cli_argv([], true)).toEqual(['tui']);
        expect(resolve_cli_argv([], false)).toEqual([]);
    });

    it('renders an original desktop utility flow instead of the reference five-step wizard', () => {
        const output = utility_window('Choose a local archive.', create_colors(false), { title: 'Conversation Library', phase: 1, width: 64 });
        expect(output).toContain('● ● ●  Conversation Library');
        expect(output).toContain('╭┬╮  OpenMemory');
        expect(output).toContain('├┼┤  Conversation Transfer');
        expect(output).toContain('╰┴╯  Local-first memory for agents');
        expect(output).toContain('✓ Library  ›  ● Review  ›  ○ Transfer');
        expect(output).toContain('Choose a local archive.');
        expect(output).not.toContain('Step 2/5');
        expect(output.split('\n').every((line) => line.length === 64)).toBe(true);
    });

    it('gives every human panel the macOS window chrome and mark', () => {
        const output = panel('Core systems are ready.', create_colors(false), { title: 'Status', width: 64 });
        expect(output).toContain('● ● ●  Status');
        expect(output).toContain('╭┬╮ OpenMemory');
        expect(output).toContain('Core systems are ready.');
        expect(output.split('\n').every((line) => line.length === 64)).toBe(true);
    });

    it('renders utility lists as inset panes inside the window', () => {
        const output = utility_window('Pick one.', create_colors(false), {
            title: 'Review Conversations', phase: 1, width: 64, list: '1  codex  read only  C:\\store',
        });
        expect(output).toContain('1  codex  read only  C:\\store');
        expect(output).toContain(`│ ${'─'.repeat(60)} │`);
        expect(output.split('\n').every((line) => line.length === 64)).toBe(true);
    });

    it('groups projects and sessions by newest activity', () => {
        const groups = group_sessions_by_project([session('old', '/a', 1), session('new', '/a', 3), session('middle', '/b', 2)]);
        expect(groups.map(([cwd]) => cwd)).toEqual(['/a', '/b']);
        expect(groups[0]?.[1].map((value) => value.source_session_id)).toEqual(['new', 'old']);
    });

    it('resolves VS Code-compatible storage on Windows, macOS, and Linux', () => {
        expect(editor_storage_roots({ APPDATA: 'C:\\Users\\dev\\AppData\\Roaming' }, 'win32')[0]).toBe('C:\\Users\\dev\\AppData\\Roaming\\Code\\User');
        expect(editor_storage_roots({ HOME: '/Users/dev' }, 'darwin')[0]).toBe('/Users/dev/Library/Application Support/Code/User');
        expect(editor_storage_roots({ HOME: '/home/dev' }, 'linux')[0]).toBe('/home/dev/.config/Code/User');
        expect(editor_storage_roots({ HOME: '/home/dev', XDG_CONFIG_HOME: '/config' }, 'linux')[3]).toBe('/config/Cursor/User');
    });

    it('detects and parses Claude Code and Codex stores without writing them', async () => {
        const root = mkdtempSync(join(tmpdir(), 'openmemory-porter-'));
        dirs.push(root);
        const claude = join(root, 'claude');
        const codex = join(root, 'codex');
        mkdirSync(claude, { recursive: true });
        mkdirSync(codex, { recursive: true });
        writeFileSync(join(claude, 'session.jsonl'), [
            JSON.stringify({ type: 'user', sessionId: 'claude-1', cwd: '/repo', timestamp: '2026-01-01T00:00:00Z', message: { role: 'user', content: 'Build the porter' } }),
            JSON.stringify({ type: 'assistant', sessionId: 'claude-1', cwd: '/repo', timestamp: '2026-01-01T00:00:01Z', message: { role: 'assistant', model: 'claude', content: [{ type: 'text', text: 'Done' }, { type: 'thinking', thinking: 'hidden' }] } }),
        ].join('\n'));
        writeFileSync(join(codex, 'rollout-1.jsonl'), [
            JSON.stringify({ type: 'session_meta', timestamp: '2026-01-02T00:00:00Z', payload: { session_id: 'codex-1', cwd: '/repo' } }),
            JSON.stringify({ type: 'response_item', timestamp: '2026-01-02T00:00:01Z', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Review the porter' }] } }),
            JSON.stringify({ type: 'response_item', timestamp: '2026-01-02T00:00:02Z', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Reviewed' }] } }),
        ].join('\n'));
        const env = { ...process.env, OPENMEMORY_CLAUDE_PROJECTS: claude, OPENMEMORY_CODEX_SESSIONS: codex, OPENCODE_DB: join(root, 'missing.db'), PATH: '' };
        const detected = await detect_harnesses(env);
        expect(detected.find((value) => value.harness === 'claude-code')).toMatchObject({ installed: true, can_import: true, source_path: claude });
        expect(detected.find((value) => value.harness === 'codex')).toMatchObject({ installed: true, can_import: true, source_path: codex });
        expect(detected.find((value) => value.harness === 'opencode')).toMatchObject({ installed: false, can_import: false });
        const claude_ref = (await get_import_adapter('claude-code').discover(env))[0] as any;
        const codex_ref = (await get_import_adapter('codex').discover(env))[0] as any;
        expect(await get_import_adapter('claude-code').parse(claude_ref, env)).toMatchObject({ source_session_id: 'claude-1', title: 'Build the porter', dropped_turns: 1, turns: [{ role: 'user' }, { role: 'assistant', model: 'claude' }] });
        expect(await get_import_adapter('codex').parse(codex_ref, env)).toMatchObject({ source_session_id: 'codex-1', title: 'Review the porter', turns: [{ role: 'user' }, { role: 'assistant' }] });
    });

    it('discovers and parses OpenCode through a read-only SQLite fallback', async () => {
        const root = mkdtempSync(join(tmpdir(), 'openmemory-opencode-'));
        dirs.push(root);
        const path = join(root, 'opencode.db');
        const database = new Database(path);
        database.exec(`
            CREATE TABLE session (id TEXT PRIMARY KEY, directory TEXT, title TEXT, version TEXT, project_id TEXT, time_created INTEGER, time_updated INTEGER);
            CREATE TABLE message (id TEXT PRIMARY KEY, session_id TEXT, time_created INTEGER, data TEXT);
            CREATE TABLE part (id TEXT PRIMARY KEY, message_id TEXT, time_created INTEGER, data TEXT);
        `);
        database.prepare('INSERT INTO session VALUES (?, ?, ?, ?, ?, ?, ?)').run('oc-1', '/repo', 'OpenCode porter', '1', 'project', 1, 4);
        database.prepare('INSERT INTO message VALUES (?, ?, ?, ?)').run('m1', 'oc-1', 2, JSON.stringify({ role: 'user' }));
        database.prepare('INSERT INTO message VALUES (?, ?, ?, ?)').run('m2', 'oc-1', 3, JSON.stringify({ role: 'assistant', modelID: 'model' }));
        database.prepare('INSERT INTO part VALUES (?, ?, ?, ?)').run('p1', 'm1', 2, JSON.stringify({ type: 'text', text: 'Port this chat' }));
        database.prepare('INSERT INTO part VALUES (?, ?, ?, ?)').run('p2', 'm2', 3, JSON.stringify({ type: 'text', text: 'Ported' }));
        database.close();
        const env = { ...process.env, OPENCODE_DB: path, PATH: '' };
        expect((await detect_harnesses(env)).find((value) => value.harness === 'opencode')).toMatchObject({ installed: true, can_import: true, source_path: path });
        const ref = (await get_import_adapter('opencode').discover(env))[0] as any;
        expect(await get_import_adapter('opencode').parse(ref, env)).toMatchObject({ source_session_id: 'oc-1', cwd: '/repo', title: 'OpenCode porter', turns: [{ role: 'user', text: 'Port this chat' }, { role: 'assistant', text: 'Ported', model: 'model' }] });
    });

    it('discovers Gemini CLI, Cline, Copilot Chat, and raw DeepSeek Harness sessions', async () => {
        const root = mkdtempSync(join(tmpdir(), 'openmemory-more-harnesses-'));
        dirs.push(root);
        const gemini = join(root, 'gemini', 'project', 'chats');
        const cline = join(root, 'cline', 'task-1');
        const copilot = join(root, 'copilot', 'workspace', 'chatSessions');
        const deepseek = join(root, 'deepseek', '--repo--', 'dsh-1');
        for (const path of [gemini, cline, copilot, deepseek]) mkdirSync(path, { recursive: true });
        writeFileSync(join(gemini, 'session-gemini-1.jsonl'), [
            JSON.stringify({ sessionId: 'gemini-1', projectHash: 'hash', startTime: '2026-01-01T00:00:00Z', lastUpdated: '2026-01-01T00:00:01Z', directories: ['/repo'] }),
            JSON.stringify({ id: 'u1', type: 'user', timestamp: '2026-01-01T00:00:00Z', content: [{ text: 'Document the API' }] }),
            JSON.stringify({ id: 'a1', type: 'gemini', timestamp: '2026-01-01T00:00:01Z', content: 'Documented', model: 'gemini' }),
        ].join('\n'));
        writeFileSync(join(cline, 'api_conversation_history.json'), JSON.stringify([
            { role: 'user', content: [{ type: 'text', text: 'Fix the build' }], ts: 1 },
            { role: 'assistant', content: [{ type: 'text', text: 'Build fixed' }, { type: 'tool_use', name: 'write_to_file' }], ts: 2, modelInfo: { id: 'model' } },
        ]));
        writeFileSync(join(copilot, 'copilot-1.jsonl'), JSON.stringify({ kind: 0, value: { sessionId: 'copilot-1', creationDate: 1, customTitle: 'Review project', requests: [{ message: { text: 'Review this code' }, response: [{ value: { value: 'Review complete' } }] }] } }));
        writeFileSync(join(deepseek, 'session.jsonl'), [
            JSON.stringify({ type: 'session', version: 0, id: 'dsh-1', createdAt: 1, cwd: '/repo', delegationDepth: 0 }),
            JSON.stringify({ type: 'user/message', seq: 0, time: 1, data: { message: 'Trace the bug' } }),
            JSON.stringify({ type: 'text-chunks', seq0: 1, time0: 2, data: { turn: 1, step: 1, index: 0, dt: [1, 1], texts: ['Bug ', 'trac', 'ed'] } }),
        ].join('\n'));
        const cases = [
            ['gemini-cli', { OPENMEMORY_GEMINI_SESSIONS: join(root, 'gemini') }, 'gemini-1', 'Document the API'],
            ['cline', { OPENMEMORY_CLINE_TASKS: join(root, 'cline') }, 'task-1', 'Fix the build'],
            ['copilot-chat', { OPENMEMORY_COPILOT_CHAT_SESSIONS: join(root, 'copilot') }, 'copilot-1', 'Review this code'],
            ['deepseek-harness', { OPENMEMORY_DEEPSEEK_HARNESS_SESSIONS: join(root, 'deepseek') }, 'dsh-1', 'Trace the bug'],
        ] as const;
        for (const [harness, override, id, first] of cases) {
            const env = { ...process.env, ...override };
            const adapter = get_import_adapter(harness);
            expect(await adapter.detect(env)).toMatchObject({ harness, can_import: true });
            const ref = (await adapter.discover(env))[0]!;
            expect(ref.source_session_id).toBe(id);
            const parsed = await adapter.parse(ref, env);
            expect(parsed).toMatchObject({ source_harness: harness, source_session_id: id, turns: [{ role: 'user', text: first }, { role: 'assistant' }] });
            if (harness === 'deepseek-harness') expect(parsed.turns[1]?.text).toBe('Bug traced');
        }
    });

    it('materializes deterministic conversation AI Wiki assets with immutable versions', async () => {
        const root = mkdtempSync(join(tmpdir(), 'openmemory-wiki-'));
        dirs.push(root);
        const chats = join(root, 'project', 'chats');
        mkdirSync(chats, { recursive: true });
        const path = join(chats, 'session-wiki-1.jsonl');
        const lines = [
            { sessionId: 'wiki-1', projectHash: 'hash', startTime: '2026-01-01T00:00:00Z', lastUpdated: '2026-01-01T00:00:01Z', directories: ['/repo'] },
            { id: 'u1', type: 'user', timestamp: '2026-01-01T00:00:00Z', content: 'Use pnpm for builds' },
            { id: 'a1', type: 'gemini', timestamp: '2026-01-01T00:00:01Z', content: 'Understood' },
        ];
        writeFileSync(path, lines.map((value) => JSON.stringify(value)).join('\n'));
        const project = await createProjectMemory({ tenant_id: 'test', project_id: 'wiki', name: 'Wiki' });
        const env = { ...process.env, OPENMEMORY_GEMINI_SESSIONS: root };
        const first = await sessions_to_wiki(project, 'wiki', 'gemini-cli', { all: true, name: 'Build knowledge', agent_id: 'builder', env });
        const duplicate = await sessions_to_wiki(project, 'wiki', 'gemini-cli', { all: true, name: 'Build knowledge', agent_id: 'builder', env });
        lines.push({ id: 'u2', type: 'user', timestamp: '2026-01-01T00:00:02Z', content: 'Run tests before package' } as any);
        writeFileSync(path, lines.map((value) => JSON.stringify(value)).join('\n'));
        const updated = await sessions_to_wiki(project, 'wiki', 'gemini-cli', { all: true, name: 'Build knowledge', agent_id: 'builder', env });
        expect(first).toMatchObject({ status: 'created', sessions: 1, turns: 2, asset: { type: 'llm_wiki', version: 1, status: 'candidate', bindings: [{ target_id: 'builder', injection_mode: 'direct' }] } });
        expect(duplicate).toMatchObject({ status: 'skipped', asset: { asset_id: first.asset.asset_id, version: 1 } });
        expect(updated).toMatchObject({ status: 'updated', turns: 3, asset: { asset_id: first.asset.asset_id, version: 2 } });
        expect(updated.asset.payload.markdown).toContain('# Build knowledge');
        expect(updated.asset.payload.markdown).toContain('### User 3');
        expect(updated.asset.payload.markdown).toContain('> Run tests before package');
        expect(updated.asset.payload.markdown).toContain('not current agent instructions');
        expect(render_session_wiki('Wiki', 'gemini-cli', [session('one', '/repo', 1)])).toContain('no model-generated claims');
        await project.close();
    });

    it('ports immutable revisions into one stable governed Chat Memory asset', async () => {
        const root = mkdtempSync(join(tmpdir(), 'openmemory-port-'));
        dirs.push(root);
        const source = join(root, 'claude');
        mkdirSync(source);
        const path = join(source, 'session.jsonl');
        const lines = [
            { type: 'user', sessionId: 'native-1', cwd: '/repo', timestamp: '2026-01-01T00:00:00Z', message: { role: 'user', content: 'Build it' } },
            { type: 'assistant', sessionId: 'native-1', cwd: '/repo', timestamp: '2026-01-01T00:00:01Z', message: { role: 'assistant', content: 'Built' } },
        ];
        writeFileSync(path, lines.map((value) => JSON.stringify(value)).join('\n'));
        const project = await createProjectMemory({ tenant_id: 'test', project_id: 'porter', name: 'Porter' });
        const env = { ...process.env, OPENMEMORY_CLAUDE_PROJECTS: source };
        const first = await port_sessions(project, 'porter', 'claude-code', { all: true, agent_id: 'builder', env });
        const duplicate = await port_sessions(project, 'porter', 'claude-code', { all: true, agent_id: 'builder', env });
        lines.push({ type: 'user', sessionId: 'native-1', cwd: '/repo', timestamp: '2026-01-01T00:00:02Z', message: { role: 'user', content: 'Add tests' } } as any);
        writeFileSync(path, lines.map((value) => JSON.stringify(value)).join('\n'));
        const grown = await port_sessions(project, 'porter', 'claude-code', { all: true, agent_id: 'builder', env });
        expect(first[0]).toMatchObject({ status: 'created' });
        expect(duplicate[0]).toMatchObject({ status: 'skipped', asset_id: first[0]?.asset_id });
        expect(grown[0]).toMatchObject({ status: 'updated', asset_id: first[0]?.asset_id });
        expect(await project.getAsset('porter', first[0]?.asset_id ?? '')).toMatchObject({ type: 'chat_memory', status: 'candidate', version: 2, metadata: { source_session_id: 'native-1' } });
        expect(await project.listSessions('porter')).toHaveLength(2);
        await project.close();
    });

    it('includes per-session parse failures in final outcomes', async () => {
        expect(parse_failure_outcome('codex', 'broken-session', 'truncated JSONL')).toMatchObject({
            source_harness: 'codex', source_session_id: 'broken-session', status: 'error', error: 'truncated JSONL',
            asset_id: expect.stringMatching(/^asset:chat_memory:porter:/),
        });
    });
});