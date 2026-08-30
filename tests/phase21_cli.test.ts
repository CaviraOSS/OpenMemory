/*
*      __                      __  ___                               
*     / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
*    / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
*   / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ / 
*  /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /  
                     /____/                                 /____/   
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : tests/phase21_cli.test.ts
 *  usage : verifies LongMemory phase21 cli.test behavior
 */

import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import pkg from '../package.json';

const root = resolve(import.meta.dirname, '..');
const entry = join(root, 'src', 'cli', 'index.ts');
const dirs: string[] = [];
const children: ChildProcess[] = [];

const bounded = async (operation: Promise<unknown>, timeout_ms: number): Promise<void> => {
    let timer: NodeJS.Timeout | undefined;
    await Promise.race([
        operation,
        new Promise<void>((resolve_timeout) => { timer = setTimeout(resolve_timeout, timeout_ms); }),
    ]).finally(() => { if (timer) clearTimeout(timer); });
};

const stop_child = async (child: ChildProcess): Promise<void> => {
    if (child.exitCode === null && child.signalCode === null) {
        const exited = new Promise<void>((resolve_exit) => child.once('exit', () => resolve_exit()));
        if (process.platform === 'win32' && child.pid) {
            const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
            await bounded(new Promise<void>((resolve_killer) => {
                killer.once('close', () => resolve_killer());
                killer.once('error', () => resolve_killer());
            }), 3_000);
            if (killer.exitCode === null) { killer.kill(); killer.unref(); }
        } else if (!child.killed) child.kill('SIGTERM');
        await bounded(exited, 3_000);
    }
    child.stdout?.destroy();
    child.stderr?.destroy();
    child.unref();
};

afterEach(async () => {
    await Promise.all(children.splice(0).map(stop_child));
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const workspace = () => {
    const dir = mkdtempSync(join(tmpdir(), 'longmemory-cli-'));
    dirs.push(dir);
    return { dir, db: join(dir, 'memory.db') };
};

function run(args: string[], env: Record<string, string | undefined> = {}, input?: string) {
    const result = spawnSync(process.execPath, ['--import', 'tsx', entry, ...args], {
        cwd: root,
        env: { ...process.env, NO_COLOR: '1', ...env },
        encoding: 'utf8',
        input,
    });
    return {
        status: result.status,
        stdout: result.stdout,
        stderr: result.stderr,
        body: result.stdout.trim() ? JSON.parse(result.stdout) as Record<string, any> : null,
    };
}

function run_jsonl(args: string[], env: Record<string, string | undefined> = {}) {
    const result = spawnSync(process.execPath, ['--import', 'tsx', entry, ...args], {
        cwd: root, env: { ...process.env, NO_COLOR: '1', ...env }, encoding: 'utf8',
    });
    return {
        status: result.status,
        stderr: result.stderr,
        lines: result.stdout.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as Record<string, any>),
    };
}

function wait_line(child: ChildProcess): Promise<string> {
    return new Promise((resolve_line, reject) => {
        let value = '';
        const timer = setTimeout(() => reject(new Error(`CLI output timed out: ${value}`)), 15_000);
        child.stdout!.setEncoding('utf8');
        child.stdout!.on('data', (chunk: string) => {
            value += chunk;
            const end = value.indexOf('\n');
            if (end < 0) return;
            clearTimeout(timer);
            resolve_line(value.slice(0, end));
        });
        child.once('error', (error) => {
            clearTimeout(timer);
            reject(error);
        });
        child.once('exit', (code) => {
            if (value.includes('\n')) return;
            clearTimeout(timer);
            reject(new Error(`CLI exited before readiness with ${code}: ${value}`));
        });
    });
}

describe('phase 21 cli', () => {
    it('1. exposes the longmemory binary and machine-readable help', () => {
        expect(pkg.bin.longmemory).toBe('dist/cli/index.js');
        const result = run(['help']);
        expect(result.status).toBe(0);
        expect(result.body?.name).toBe('longmemory');
        expect(result.stderr).not.toMatch(/\u001b\[/);
        expect(run(['--version']).body).toMatchObject({ name: 'longmemory', version: pkg.version });
    });

    it('2. starts the shared API server with the selected database', async () => {
        const { db } = workspace();
        const child = spawn(process.execPath, ['--import', 'tsx', entry, 'serve', '--port', '0', '--db', db], {
            cwd: root,
            env: { ...process.env, NO_COLOR: '1' },
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        children.push(child);
        const ready = JSON.parse(await wait_line(child)) as { ready: boolean; url: string; db_path: string };
        const health = await fetch(`${ready.url}/health`).then((response) => response.json()) as { data: { ok: boolean } };
        expect(ready.ready).toBe(true);
        expect(ready.db_path).toBe(db);
        expect(health.data.ok).toBe(true);
        await stop_child(child);
        children.splice(children.indexOf(child), 1);
    }, 20_000);

    it('3. ingests into SQLite and emits readable JSON', () => {
        const { db } = workspace();
        const result = run(['ingest', '--user', 'u1', '--text', 'I prefer tea', '--db', db, '--pretty']);
        expect(result.status).toBe(0);
        expect(result.body?.node.content.raw).toBe('I prefer tea');
        expect(result.stdout).toContain('\n  "node"');
        expect(existsSync(db)).toBe(true);
    });

    it('initializes the database and project hierarchy together', () => {
        const { db } = workspace();
        const initialized = run(['init', '--project', 'alpha', '--db', db]);
        const status = run(['status', '--project', 'alpha', '--db', db]);
        expect(initialized.status).toBe(0);
        expect(status.body?.project).toMatchObject({ id: 'alpha', initialized: true });
        expect(status.body?.memory.worlds).toBeGreaterThan(1);
    });

    it('doctor diagnoses a fresh workspace without creating its database', () => {
        const { db } = workspace();
        const result = run(['doctor', '--db', db]);
        expect(result.status).toBe(0);
        expect(result.body?.checks.find((item: { check: string }) => item.check === 'database')).toMatchObject({ status: 'warn' });
        expect(existsSync(db)).toBe(false);
    });

    it('ingests large editor selections from stdin', () => {
        const { db } = workspace();
        const text = `Selected implementation\n${'const value = 1;\n'.repeat(1_000)}`;
        const result = run(['ingest', '--stdin', '--source', 'vscode-selection', '--db', db], {}, text);
        expect(result.status).toBe(0);
        expect(result.body?.node.content.raw).toBe(text.trim());
    });

    it('persists structured native-client metadata without overriding scope', () => {
        const { db } = workspace();
        const metadata = JSON.stringify({ change_id: 'change-1', agent: 'copilot', attribution_confidence: 'explicit', files: ['src/a.ts'], project_id: 'wrong' });
        const result = run(['ingest', '--stdin', '--source', 'vscode-agent:copilot', '--type', 'agent_change', '--metadata-json', metadata, '--db', db], {}, 'Copilot changed src/a.ts');
        expect(result.status).toBe(0);
        expect(result.body?.node.metadata).toMatchObject({ change_id: 'change-1', agent: 'copilot', attribution_confidence: 'explicit', files: ['src/a.ts'], project_id: expect.any(String), memory_type: 'agent_change' });
        expect(result.body?.node.metadata.project_id).not.toBe('wrong');
    });

    it('4. recalls strict and historical truth from the same database path', () => {
        const { db } = workspace();
        const jan = String(Date.UTC(2026, 0, 1));
        const mar = String(Date.UTC(2026, 2, 1));
        const apr = String(Date.UTC(2026, 3, 1));
        const old = run(['ingest', '--user', 'u1', '--text', 'I prefer tea', '--at', jan, '--db', db]);
        const current = run(['ingest', '--user', 'u1', '--text', 'I now prefer coffee instead of tea', '--at', mar, '--db', db]);
        const strict = run(['recall', '--user', 'u1', '--query', 'what do I prefer', '--mode', 'strict', '--at', apr, '--db', db]);
        const historical = run(['recall', '--user', 'u1', '--query', 'what did I prefer', '--mode', 'historical', '--valid-time', String(Number(jan) + 1), '--db', db]);
        const strict_ids = strict.body?.items.map((item: { node: { id: string } }) => item.node.id);
        const historical_ids = historical.body?.timeline.world_truth_at_time.map((item: { id: string }) => item.id);
        expect(strict.status).toBe(0);
        expect(strict_ids).toContain(current.body?.node.id);
        expect(strict_ids).not.toContain(old.body?.node.id);
        expect(historical_ids).toContain(old.body?.node.id);
    });

    it('5. explains a persisted memory', () => {
        const { db } = workspace();
        const ingested = run(['ingest', '--user', 'u1', '--text', 'I prefer tea', '--db', db]);
        const explained = run(['explain', '--id', ingested.body?.node.id, '--db', db]);
        expect(explained.status).toBe(0);
        expect(explained.body?.node.id).toBe(ingested.body?.node.id);
        expect(explained.body?.incoming_edges).toEqual([]);
    });

    it('6. runs the packaged benchmark command', () => {
        const result = run(['bench']);
        expect(result.status).toBe(0);
        expect(result.body?.passed).toBe(true);
        expect(result.body?.checks.length).toBeGreaterThan(0);
    });

    it('7. uses --db consistently across finite commands', () => {
        const { db } = workspace();
        const ingested = run(['ingest', '--user', 'u1', '--text', 'I prefer tea', '--db', db]);
        const explained = run(['explain', '--id', ingested.body?.node.id, '--db', db]);
        const status = run(['status', '--db', db]);
        const status_with_memories = run(['status', '--memories', '1', '--db', db]);
        expect(status.status).toBe(0);
        expect(status.body?.db_path).toBe(db);
        expect(status.body?.memory.nodes).toBe(1);
        expect(status_with_memories.body?.recent_memories).toHaveLength(1);
        expect(status_with_memories.body?.recent_memories[0].id).toBe(ingested.body?.memory_id);
        expect(explained.body?.node.content.raw).toBe('I prefer tea');
    });

    it('lists project memories for native clients', () => {
        const { db } = workspace();
        const first = run(['ingest', '--user', 'u1', '--text', 'Remember the release checklist', '--db', db]);
        run(['ingest', '--user', 'u1', '--text', 'Remember the migration plan', '--db', db]);
        const listed = run(['memory', 'list', '--limit', '1', '--db', db]);
        expect(listed.status).toBe(0);
        expect(listed.body).toMatchObject({ ok: true, count: 1, limit: 1 });
        expect(listed.body?.memories[0]).toMatchObject({ status: 'active', grounded: false });
        expect(typeof listed.body?.memories[0].id).toBe('string');
        expect(first.body?.memory_id).toBeTruthy();
    });

    it('runs decay maintenance and reinforces a persisted memory', () => {
        const { db } = workspace();
        const jan = String(Date.UTC(2026, 0, 1));
        const mar = String(Date.UTC(2026, 2, 1));
        const ingested = run(['ingest', '--user', 'u1', '--text', 'Keep the rollback procedure', '--at', jan, '--db', db]);
        const decay = run(['maintenance', 'decay', '--at', mar, '--all', '--db', db]);
        const reinforced = run(['maintenance', 'reinforce', ingested.body?.memory_id, '--at', mar, '--db', db]);
        expect(decay.status).toBe(0);
        expect(decay.body).toMatchObject({ ok: true, complete: true, scanned: 1, updated: 1 });
        expect(reinforced.status).toBe(0);
        expect(reinforced.body?.reinforcement_count).toBe(1);
        expect(reinforced.body?.activation).toBeGreaterThan(0);
    });

    it('manages reusable Skills and imports past agent sessions', () => {
        const { dir, db } = workspace();
        const created = run([
            'skill', 'create', '--project', 'alpha', '--db', db, '--name', 'Release check', '--description', 'Validate releases',
            '--triggers', 'release checklist,publish package', '--instructions-json', '["Run tests","Build packages"]', '--validation-json', '["Tests pass"]',
        ]);
        const skill_id = created.body?.skill.skill_id;
        const bound = run(['skill', 'bind', skill_id, '--agents', 'reviewer', '--project', 'alpha', '--db', db]);
        const matched = run(['skill', 'match', 'run the release checklist', '--agent', 'reviewer', '--project', 'alpha', '--db', db]);
        const context = run(['project', 'context', 'run the release checklist', '--agent', 'reviewer', '--project', 'alpha', '--db', db]);
        expect(created.status).toBe(0);
        expect(bound.body?.skill).toMatchObject({ version: 2, agent_ids: ['reviewer'] });
        expect(matched.body?.matches[0].skill.skill_id).toBe(skill_id);
        expect(context.body?.matched_skills[0].skill.skill_id).toBe(skill_id);
        expect(context.body?.asset_loadout.selected[0].asset.type).toBe('skill');

        const registered = run([
            'asset', 'register', '--project', 'alpha', '--db', db, '--type', 'llm_wiki', '--name', 'Architecture wiki',
            '--description', 'Project architecture', '--owner', 'alice', '--source-type', 'docs',
            '--content-ref', 'longmemory://project/alpha/wiki/architecture', '--status', 'approved', '--visibility', 'project',
            '--frameworks', 'vscode', '--mode', 'tool', '--priority', '0.8',
        ]);
        const asset_id = registered.body?.asset.asset_id;
        const loadout = run(['asset', 'loadout', 'architecture release', '--agent', 'reviewer', '--framework', 'vscode', '--project', 'alpha', '--db', db]);
        const manifest = run(['agent', 'manifest', 'reviewer', '--query', 'architecture release', '--framework', 'vscode', '--project', 'alpha', '--db', db]);
        expect(registered.status).toBe(0);
        expect(loadout.body?.selected.map((item: { asset: { asset_id: string } }) => item.asset.asset_id)).toContain(asset_id);
        expect(manifest.body?.manifest).toMatchObject({ schema: 'https://longmemory.dev/schemas/agent-memory-manifest/v1', agent: { id: 'reviewer', framework: 'vscode' } });

        const session_path = join(dir, 'session.json');
        writeFileSync(session_path, JSON.stringify({
            session_id: 'codex-42', agent_id: 'builder', provider: 'codex', started_at: 100,
            messages: [{ role: 'user', content: 'Implement Skills.' }, { role: 'assistant', content: 'Skills implemented.' }],
        }));
        const imported = run(['session', 'import', session_path, '--project', 'alpha', '--db', db]);
        const sessions = run(['session', 'list', '--project', 'alpha', '--db', db]);
        expect(imported.body?.session).toMatchObject({ session_id: 'codex-42', message_count: 2, started_at: 100, ended_at: 101 });
        expect(sessions.body?.sessions).toEqual([expect.objectContaining({ session_id: 'codex-42', message_count: 2 })]);
    });

    it('detects, previews, ports, updates, verifies, and streams coding-harness sessions', () => {
        const { dir, db } = workspace();
        const source = join(dir, 'claude-projects');
        const session_path = join(source, 'session.jsonl');
        mkdirSync(source, { recursive: true });
        const turns: Array<Record<string, unknown>> = [
            { type: 'user', sessionId: 'claude-native-1', cwd: dir, timestamp: '2026-01-01T00:00:00Z', message: { role: 'user', content: 'Build the CLI porter' } },
            { type: 'assistant', sessionId: 'claude-native-1', cwd: dir, timestamp: '2026-01-01T00:00:01Z', message: { role: 'assistant', content: 'Porter built' } },
        ];
        writeFileSync(session_path, turns.map((turn) => JSON.stringify(turn)).join('\n'));
        const env = { LONGMEMORY_CLAUDE_PROJECTS: source, LONGMEMORY_CODEX_SESSIONS: join(dir, 'missing-codex'), OPENCODE_DB: join(dir, 'missing-opencode.db'), PATH: '' };
        const detected = run(['detect', '--project', 'alpha', '--db', db], env);
        const discovered = run(['session', 'discover', '--from', 'claude-code', '--project', 'alpha', '--db', db], env);
        const first = run(['port', '--from', 'claude-code', '--to', 'longmemory', '--all', '--agent', 'builder', '--project', 'alpha', '--db', db], env);
        const duplicate = run(['port', '--from', 'claude-code', '--to', 'longmemory', '--all', '--agent', 'builder', '--project', 'alpha', '--db', db], env);
        turns.push({ type: 'user', sessionId: 'claude-native-1', cwd: dir, timestamp: '2026-01-01T00:00:02Z', message: { role: 'user', content: 'Add regression tests' } });
        writeFileSync(session_path, turns.map((turn) => JSON.stringify(turn)).join('\n'));
        const updated = run(['port', '--from', 'claude-code', '--to', 'longmemory', '--all', '--agent', 'builder', '--project', 'alpha', '--db', db], env);
        const verified = run(['verify', '--from', 'claude-code', '--sample', '1', '--project', 'alpha', '--db', db], env);
        const streamed = run_jsonl(['port', '--from', 'claude-code', '--to', 'longmemory', '--all', '--force', '--jsonl', '--project', 'alpha', '--db', db], env);

        expect(detected.body?.harnesses.find((item: { harness: string }) => item.harness === 'claude-code')).toMatchObject({ installed: true, can_import: true, source_path: source });
        expect(discovered.body).toMatchObject({ harness: 'claude-code', count: 1, projects: [expect.objectContaining({ cwd: dir })] });
        expect(first.body?.counts).toMatchObject({ created: 1, updated: 0, skipped: 0, errors: 0 });
        expect(duplicate.body?.counts).toMatchObject({ created: 0, updated: 0, skipped: 1, errors: 0 });
        expect(updated.body?.counts).toMatchObject({ created: 0, updated: 1, skipped: 0, errors: 0 });
        expect(verified.body).toMatchObject({ ok: true, discovered: 1, verified: 1, failures: [] });
        expect(streamed.status).toBe(0);
        expect(streamed.lines.some((line) => line.type === 'import:progress')).toBe(true);
        expect(streamed.lines.at(-1)).toMatchObject({ type: 'summary', counts: { updated: 1, errors: 0 } });
    });

    it('keeps project reads, ingest, and maintenance isolated', () => {
        const { db } = workspace();
        expect(run(['project', 'init', '--project', 'alpha', '--db', db]).status).toBe(0);
        expect(run(['project', 'init', '--project', 'beta', '--db', db]).status).toBe(0);
        const alpha = run(['ingest', '--project', 'alpha', '--text', 'Alpha uses port 7331', '--source', 'alpha.md', '--db', db]);
        const beta = run(['ingest', '--project', 'beta', '--text', 'Beta uses port 8443', '--source', 'beta.md', '--db', db]);
        const alpha_list = run(['memory', 'list', '--project', 'alpha', '--db', db]);
        const alpha_recall = run(['recall', 'which port does Alpha use', '--mode', 'associative', '--project', 'alpha', '--db', db]);
        const wrong_project = run(['memory', 'list', '--project', 'missing', '--db', db]);
        const cross_explain = run(['explain', beta.body?.memory_id, '--project', 'alpha', '--db', db]);
        const cross_reinforce = run(['maintenance', 'reinforce', beta.body?.memory_id, '--project', 'alpha', '--db', db]);
        const decay = run(['maintenance', 'decay', '--all', '--project', 'alpha', '--db', db]);
        const alpha_explain = run(['explain', alpha.body?.memory_id, '--project', 'alpha', '--db', db]);
        const beta_explain = run(['explain', beta.body?.memory_id, '--project', 'beta', '--db', db]);

        expect(alpha_list.body?.memories.map((item: { id: string }) => item.id)).toEqual([alpha.body?.memory_id]);
        expect(alpha_list.body?.memories[0].source).toBe('alpha.md');
        expect(alpha_recall.body?.hits.some((hit: { id: string }) => hit.id === alpha.body?.memory_id)).toBe(true);
        expect(wrong_project.status).toBe(2);
        expect(JSON.parse(wrong_project.stderr).error.code).toBe('project_not_found');
        expect(cross_explain.status).toBe(2);
        expect(cross_reinforce.status).toBe(2);
        expect(decay.body).toMatchObject({ scanned: 1, updated: 1 });
        expect(alpha_explain.body?.node.state.decay_updated_at).not.toBeNull();
        expect(beta_explain.body?.node.state.decay_updated_at).toBeNull();
    });

    it('returns useful JSON errors and nonzero status', () => {
        const result = run(['recall', '--user', 'u1', '--query', 'anything']);
        expect(result.status).toBe(2);
        expect(result.body).toBeNull();
        expect(JSON.parse(result.stderr).error).toMatchObject({ code: 'validation_error', message: '--mode is required' });
    });
});