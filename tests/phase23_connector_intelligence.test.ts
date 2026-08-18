import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createMemory as create_memory } from '../src/index.js';
import {
    analyze_file,
    configurable_connector,
    connector_definitions,
    default_connector_registry,
    detect_file_language,
    github_connector,
    local_file_connector,
    sync_connector,
    supported_file_languages,
} from '../src/index.js';

const dirs: string[] = [];

afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const workspace = () => {
    const dir = mkdtempSync(join(tmpdir(), 'openmemory-sources-'));
    dirs.push(dir);
    return dir;
};

const json = (value: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json', 'x-ratelimit-limit': '5000', 'x-ratelimit-remaining': '4990', 'x-ratelimit-used': '10', 'x-ratelimit-reset': '1780000000', ...headers },
});

function github_fetch() {
    const calls: string[] = [];
    const repository = {
        id: 1, node_id: 'repo-node', full_name: 'cavira/openmemory', name: 'openmemory', html_url: 'https://github.com/cavira/openmemory',
        description: 'Hydrograph memory', private: false, fork: false, archived: false, disabled: false, visibility: 'public',
        default_branch: 'main', language: 'TypeScript', topics: ['memory', 'hydrograph'], license: { spdx_id: 'Apache-2.0' },
        owner: { login: 'cavira' }, size: 42, forks_count: 3, stargazers_count: 90, subscribers_count: 7,
        open_issues_count: 4, network_count: 3, has_issues: true, has_projects: true, has_wiki: true, has_pages: false,
        has_discussions: true, clone_url: 'https://github.com/cavira/openmemory.git', ssh_url: 'git@github.com:cavira/openmemory.git',
        git_url: 'git://github.com/cavira/openmemory.git', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z', pushed_at: '2026-07-01T00:00:00Z',
    };
    const fetcher: typeof fetch = async (input) => {
        const url = new URL(String(input));
        calls.push(`${url.pathname}${url.search}`);
        const path = url.pathname;
        if (path === '/repos/cavira/openmemory') return json(repository, 200, { etag: 'repo-v1' });
        if (path.endsWith('/git/trees/main')) return json({ truncated: false, tree: [
            { path: 'src', type: 'tree', sha: 'dir-sha', mode: '040000', url: 'tree-url' },
            { path: 'src/index.ts', type: 'blob', sha: 'file-sha', mode: '100644', size: 116, url: 'blob-url' },
            { path: 'README.md', type: 'blob', sha: 'readme-sha', mode: '100644', size: 30, url: 'readme-url' },
        ] });
        if (path.endsWith('/contents/src/index.ts')) return json({
            type: 'file', name: 'index.ts', path: 'src/index.ts', sha: 'file-sha', size: 116, encoding: 'base64',
            content: Buffer.from("import { createMemory } from './memory.js';\nexport class OpenMemory {}\nexport const run = () => createMemory();\n").toString('base64'),
            html_url: 'https://github.com/cavira/openmemory/blob/main/src/index.ts', download_url: 'https://raw.example/index.ts', git_url: 'blob-url', url: 'api-url',
        });
        if (path.endsWith('/commits') && url.searchParams.get('path') === 'src/index.ts') return json([{
            sha: 'commit-sha', html_url: 'https://github.com/cavira/openmemory/commit/commit-sha',
            commit: { message: 'feat: source intelligence', author: { name: 'Ada', date: '2026-07-01T00:00:00Z' }, committer: { name: 'Ada', date: '2026-07-01T00:00:00Z' }, verification: { verified: true } },
        }]);
        if (path.endsWith('/languages')) return json({ TypeScript: 1000, Markdown: 200 });
        if (path.endsWith('/branches')) return json([{ name: 'main', protected: true, commit: { sha: 'commit-sha' } }]);
        if (path.endsWith('/tags')) return json([{ name: 'v1.0.0', commit: { sha: 'tag-sha' }, tarball_url: 'tar', zipball_url: 'zip' }]);
        if (path.endsWith('/releases') && !/\/releases\/\d+$/.test(path)) return json([{ id: 8, node_id: 'release-node', name: 'v1', tag_name: 'v1.0.0', html_url: 'release-url', body: 'Stable release', assets: [], created_at: '2026-06-01T00:00:00Z', published_at: '2026-06-01T00:00:00Z' }]);
        if (path.endsWith('/contributors')) return json([{ login: 'ada', id: 2, contributions: 42, type: 'User', avatar_url: 'avatar', html_url: 'profile' }]);
        if (path.endsWith('/issues')) return json([{ number: 12, node_id: 'issue-node', title: 'Track source freshness', body: 'Need cursors', state: 'open', html_url: 'issue-url', created_at: '2026-06-01T00:00:00Z', updated_at: '2026-06-02T00:00:00Z', labels: [{ name: 'sources' }], assignees: [], user: { login: 'ada' }, comments: 1 }]);
        if (path.endsWith('/pulls')) return json([{ number: 7, node_id: 'pull-node', title: 'Deep GitHub source', body: 'Adds analysis', state: 'open', html_url: 'pull-url', created_at: '2026-06-01T00:00:00Z', updated_at: '2026-06-02T00:00:00Z', labels: [], requested_reviewers: [], base: { label: 'main' }, head: { label: 'sources' } }]);
        if (path === '/repos/cavira/openmemory/commits') return json([{ sha: 'commit-sha', html_url: 'commit-url', commit: { message: 'feat: source intelligence', author: { date: '2026-07-01T00:00:00Z' }, committer: { date: '2026-07-01T00:00:00Z' } }, parents: [] }]);
        throw new Error(`unexpected GitHub fixture request: ${url}`);
    };
    return { fetcher, calls };
}

describe('connector catalog and file intelligence', () => {
    it('registers more than twenty additional connector providers', () => {
        expect(connector_definitions.length).toBeGreaterThanOrEqual(45);
        expect(new Set(connector_definitions.map((item) => item.id)).size).toBe(connector_definitions.length);
        expect(default_connector_registry.list()).toHaveLength(connector_definitions.length);
        for (const id of ['github', 'gitlab', 'bitbucket', 'azure_devops', 'google_drive', 'notion', 'slack', 'jira', 's3', 'mongodb', 'local', 'rss']) {
            expect(default_connector_registry.has(id)).toBe(true);
        }
    });

    it('detects broad programming, config, data, and document languages', () => {
        expect(supported_file_languages.length).toBeGreaterThan(60);
        expect(detect_file_language('src/app.ts')).toBe('TypeScript');
        expect(detect_file_language('service/main.py')).toBe('Python');
        expect(detect_file_language('infra/main.tf')).toBe('Terraform');
        expect(detect_file_language('Dockerfile')).toBe('Dockerfile');
        expect(detect_file_language('script', '#!/usr/bin/env bash\necho ok')).toBe('Shell');
    });

    it('extracts symbols, imports, exports, dependencies, roles, and manifest details', () => {
        const source = [
            "import { readFile } from 'node:fs/promises';",
            "import type { Config } from '@scope/config';",
            'export interface source_config { root: string }',
            'export class repository_source {}',
            'export const create_source = () => readFile;',
        ].join('\n');
        const analysis = analyze_file('src/repository.ts', source);
        expect(analysis.language).toBe('TypeScript');
        expect(analysis.role).toBe('source');
        expect(analysis.imports).toEqual(expect.arrayContaining(['node:fs/promises', '@scope/config']));
        expect(analysis.dependencies).toEqual(expect.arrayContaining(['node:fs', '@scope/config']));
        expect(analysis.exports).toEqual(expect.arrayContaining(['source_config', 'repository_source', 'create_source']));
        expect(analysis.symbols.some((item) => item.kind === 'class' && item.line === 4)).toBe(true);
        const manifest = analyze_file('package.json', JSON.stringify({ name: 'openmemory', scripts: { test: 'vitest' }, dependencies: { zod: '1' } }));
        expect(manifest.role).toBe('configuration');
        expect(manifest.metadata).toMatchObject({ package_name: 'openmemory', scripts: { test: 'vitest' } });
    });

    it('lists and analyzes local files without allowing path escape', async () => {
        const root = workspace();
        mkdirSync(join(root, 'src'));
        writeFileSync(join(root, 'src', 'app.py'), 'from pathlib import Path\n\nclass App:\n    pass\n');
        writeFileSync(join(root, 'README.md'), '# Project\n\nRepository docs.');
        const connector = new local_file_connector({ root });
        await connector.connect();
        const refs = await connector.listSources();
        expect(refs.map((item) => item.metadata.path)).toEqual(['README.md', 'src/app.py']);
        const document = await connector.fetchSource(refs.find((item) => item.metadata.path === 'src/app.py')!);
        expect('content' in document && (document.metadata.analysis as { language: string }).language).toBe('Python');
        expect('content' in document && ((document.metadata.analysis as { symbols: Array<{ name: string }> }).symbols.some((item) => item.name === 'App'))).toBe(true);
        await expect(connector.fetchSource({ ...refs[0], external_id: '../outside.txt' })).rejects.toThrow('escapes source root');
    });

    it('maps arbitrary paginated JSON APIs with typed field paths', async () => {
        const fetcher: typeof fetch = async (input) => {
            const url = new URL(String(input));
            if (url.pathname === '/items') return json({ data: { records: [{ key: 'a', title: 'Alpha', body: 'Source content', links: { html: 'https://example.test/a' } }], next: null, total: 1 } });
            return json({ key: 'a', title: 'Alpha', body: 'Source content', links: { html: 'https://example.test/a' } });
        };
        const connector = new configurable_connector({
            id: 'fixture', name: 'Fixture', source_type: 'fixture', status: 'configurable', category: 'database', auth: 'none',
            credential_env: [], documentation_url: 'https://example.test', maps: ['records'], required_config: ['list_url', 'item_url', 'fields'],
        }, {
            list_url: 'https://api.example.test/items', item_url: 'https://api.example.test/items/{id}',
            response_path: 'data.records', next_cursor_path: 'data.next', total_path: 'data.total',
            fields: { id: 'key', name: 'title', text: 'body', uri: 'links.html' }, fetch: fetcher,
        });
        await connector.connect();
        const refs = await connector.listSources({ limit: 10 });
        const document = await connector.fetchSource(refs[0]);
        expect(refs[0]).toMatchObject({ external_id: 'a', title: 'Alpha', url: 'https://example.test/a' });
        expect('content' in document && document.content).toBe('Source content');
    });

    it('ingests source documents through the shared Hydrograph facade', async () => {
        const root = workspace();
        writeFileSync(join(root, 'knowledge.md'), '# Preference\n\nI prefer source-aware memory.');
        const connector = new local_file_connector({ root });
        await connector.connect();
        const memory = await create_memory();
        const report = await sync_connector(connector, memory, { mode: 'full' });
        expect(report).toMatchObject({ connector_id: 'local', discovered: 1, created: 1, failures: [] });
        const explanation = await memory.explain(report.node_ids[0]);
        expect(explanation.node?.world.zone).toBe('exocortex');
        expect(explanation.node?.provenance.source_trace[0].source_id).toBe('local');
        await memory.close();
    });
});

describe('deep GitHub connector', () => {
    it('inventories every repository path with stable metadata', async () => {
        const fixture = github_fetch();
        const connector = new github_connector({ owner: 'cavira', repo: 'openmemory', fetch: fixture.fetcher, requests_per_second: 10_000 });
        await connector.connect();
        const refs = await connector.listSources({ kinds: ['repository', 'folder', 'file'] });
        const snapshot = await connector.inspectRepository();
        expect(refs).toHaveLength(4);
        expect(refs.find((item) => item.kind === 'repository')?.metadata).toMatchObject({ default_branch: 'main', stars: 90, topics: ['memory', 'hydrograph'] });
        expect(refs.find((item) => item.metadata.path === 'src/index.ts')).toMatchObject({ checksum: 'file-sha' });
        expect(snapshot.rate_limit).toMatchObject({ limit: 5000, remaining: 4990 });
    });

    it('fetches file content with structural analysis and commit history', async () => {
        const fixture = github_fetch();
        const connector = new github_connector({ owner: 'cavira', repo: 'openmemory', fetch: fixture.fetcher, requests_per_second: 10_000 });
        await connector.connect();
        const refs = await connector.listSources({ kinds: ['file'] });
        const item = refs.find((entry) => entry.metadata.path === 'src/index.ts')!;
        const document = await connector.fetchSource(item);
        const analysis = 'content' in document ? document.metadata.analysis as { language: string; role: string; line_count: number; imports: string[]; exports: string[] } : null;
        expect(analysis).toMatchObject({ language: 'TypeScript', role: 'source', line_count: 4 });
        expect(analysis?.imports).toContain('./memory.js');
        expect(analysis?.exports).toEqual(expect.arrayContaining(['OpenMemory', 'run']));
        expect(document.metadata.commit_history).toEqual([expect.objectContaining({ sha: 'commit-sha', verified: true })]);
        expect(document.metadata.repository).toMatchObject({ full_name: 'cavira/openmemory', license: { spdx_id: 'Apache-2.0' } });
    });

    it('builds a rich repository snapshot and lists collaboration objects', async () => {
        const fixture = github_fetch();
        const connector = new github_connector({ owner: 'cavira', repo: 'openmemory', fetch: fixture.fetcher, requests_per_second: 10_000 });
        await connector.connect();
        const snapshot = await connector.inspectRepository();
        const collaboration = await connector.listSources({ kinds: ['issue', 'pull_request', 'commit', 'document'], limit: 100 });
        expect(snapshot.totals).toEqual({ files: 2, bytes: 146, languages: 2, branches: 1, tags: 1, releases: 1, contributors: 1 });
        expect(snapshot.languages).toEqual({ TypeScript: 1000, Markdown: 200 });
        expect(snapshot.contributors[0]).toMatchObject({ login: 'ada', contributions: 42 });
        expect(collaboration.map((item) => item.kind)).toEqual(['issue', 'pull_request', 'commit', 'document']);
        expect(collaboration.find((item) => item.kind === 'pull_request')?.metadata).toMatchObject({ number: 7, base: { label: 'main' }, head: { label: 'sources' } });
    });
});