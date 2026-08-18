import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import pkg from '../package.json';

const root = resolve(import.meta.dirname, '..');
const entry = join(root, 'src', 'cli', 'index.ts');
const dirs: string[] = [];
const children: ChildProcess[] = [];

afterEach(async () => {
    await Promise.all(children.splice(0).map((child) => {
        if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
        const exited = new Promise<void>((resolve_exit) => child.once('exit', () => resolve_exit()));
        if (!child.killed) child.kill();
        return exited;
    }));
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const workspace = () => {
    const dir = mkdtempSync(join(tmpdir(), 'openmemory-cli-'));
    dirs.push(dir);
    return { dir, db: join(dir, 'memory.db') };
};

function run(args: string[], env: NodeJS.ProcessEnv = {}) {
    const result = spawnSync(process.execPath, ['--import', 'tsx', entry, ...args], {
        cwd: root,
        env: { ...process.env, NO_COLOR: '1', ...env },
        encoding: 'utf8',
    });
    return {
        status: result.status,
        stdout: result.stdout,
        stderr: result.stderr,
        body: result.stdout.trim() ? JSON.parse(result.stdout) as Record<string, any> : null,
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
    it('1. exposes the openmemory binary and machine-readable help', () => {
        expect(pkg.bin.openmemory).toBe('dist/cli/index.js');
        const result = run(['help']);
        expect(result.status).toBe(0);
        expect(result.body?.name).toBe('openmemory');
        expect(result.stderr).not.toMatch(/\u001b\[/);
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
        child.kill('SIGTERM');
    });

    it('3. ingests into SQLite and emits readable JSON', () => {
        const { db } = workspace();
        const result = run(['ingest', '--user', 'u1', '--text', 'I prefer tea', '--db', db, '--pretty']);
        expect(result.status).toBe(0);
        expect(result.body?.node.content.raw).toBe('I prefer tea');
        expect(result.stdout).toContain('\n  "node"');
        expect(existsSync(db)).toBe(true);
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
        expect(status.status).toBe(0);
        expect(status.body?.db_path).toBe(db);
        expect(status.body?.memory.nodes).toBe(1);
        expect(explained.body?.node.content.raw).toBe('I prefer tea');
    });

    it('returns useful JSON errors and nonzero status', () => {
        const result = run(['recall', '--user', 'u1', '--query', 'anything']);
        expect(result.status).toBe(2);
        expect(result.body).toBeNull();
        expect(JSON.parse(result.stderr).error).toMatchObject({ code: 'validation_error', message: '--mode is required' });
    });
});