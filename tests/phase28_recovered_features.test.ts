import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import {
    createMemory as create_memory,
    default_connector_registry,
    document_connector,
    extract_content,
    google_drive_connector,
    notion_connector,
    sync_connector,
} from '../src/index.js';
import { create_open_memory_server } from '../src/server/app.js';
import { load_server_config } from '../src/server/config.js';

const dirs: string[] = [];
const servers: Server[] = [];

afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const workspace = () => {
    const dir = mkdtempSync(join(tmpdir(), 'openmemory-recovered-'));
    dirs.push(dir);
    return dir;
};

const json = (value: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
});

describe('recovered document and media extraction', () => {
    it('converts HTML into structured Markdown', async () => {
        const extracted = await extract_content({ data: '<h1>Architecture</h1><p>Use immutable nodes.</p>', content_type: 'html' });
        expect(extracted.text).toContain('# Architecture');
        expect(extracted.text).toContain('Use immutable nodes.');
        expect(extracted.metadata).toMatchObject({ content_type: 'html', extraction_method: 'turndown' });
    });

    it('sends audio through the transcription API without leaking provider logic into Hydrograph', async () => {
        const calls: Array<{ url: string; authorization: string | null }> = [];
        const extracted = await extract_content({
            data: Buffer.from('audio bytes'), content_type: 'audio', filename: 'note.mp3', openai_api_key: 'test-key',
            fetch: async (input, init) => {
                calls.push({ url: String(input), authorization: new Headers(init?.headers).get('authorization') });
                return json({ text: 'Connectors preserve provenance.', duration: 4.5, language: 'en' });
            },
        });
        expect(calls).toEqual([{ url: 'https://api.openai.com/v1/audio/transcriptions', authorization: 'Bearer test-key' }]);
        expect(extracted).toMatchObject({ text: 'Connectors preserve provenance.', metadata: { content_type: 'audio', duration_seconds: 4.5, language: 'en' } });
    });

    it('syncs local HTML documents through import plans and strict recall', async () => {
        const root = workspace();
        writeFileSync(join(root, 'architecture.html'), '<h1>Architecture</h1><p>The project uses immutable HydroNodes.</p>');
        const connector = new document_connector({ root, include: 'documents' });
        await connector.connect();
        const memory = create_memory();
        const report = await sync_connector(connector, memory, { mode: 'full' });
        const recalled = await memory.recall({ text: 'immutable HydroNodes', mode: 'strict', permission_context: { allow_private: true } });
        expect(report).toMatchObject({ discovered: 1, created: 1, failures: [] });
        expect('items' in recalled && recalled.items.some((item) => item.node.content.raw.includes('immutable HydroNodes'))).toBe(true);
        await memory.close();
    });
});

describe('recovered provider-native cloud connectors', () => {
    it('lists and exports Google Drive native documents', async () => {
        const calls: string[] = [];
        const fetcher: typeof fetch = async (input) => {
            const url = new URL(String(input));
            calls.push(`${url.pathname}${url.search}`);
            if (url.pathname === '/drive/v3/files' && !url.searchParams.has('fields')) throw new Error('missing fields');
            if (url.pathname === '/drive/v3/files') return json({ files: [{ id: 'doc-1', name: 'Design', mimeType: 'application/vnd.google-apps.document', modifiedTime: '2026-07-01T00:00:00Z', version: '7', webViewLink: 'https://drive.google.com/doc-1' }] });
            if (url.pathname === '/drive/v3/files/doc-1' && !url.pathname.endsWith('/export')) return json({ id: 'doc-1', name: 'Design', mimeType: 'application/vnd.google-apps.document', modifiedTime: '2026-07-01T00:00:00Z', version: '7', webViewLink: 'https://drive.google.com/doc-1' });
            if (url.pathname.endsWith('/export')) return new Response('# Design\n\nUse Hydrograph plans.', { headers: { 'content-type': 'text/markdown' } });
            throw new Error(`unexpected Google request: ${url}`);
        };
        const connector = new google_drive_connector({ access_token: 'google-token', fetch: fetcher });
        await connector.connect();
        const refs = await connector.listSources();
        const document = await connector.fetchSource(refs[0]);
        expect(refs[0]).toMatchObject({ external_id: 'doc-1', title: 'Design' });
        expect('content' in document && document.content).toContain('Hydrograph plans');
        expect(calls.some((call) => call.includes('/export?') && (call.includes('mimeType=text%2Fmarkdown') || call.includes('mimeType=text/markdown')))).toBe(true);
    });

    it('renders Notion blocks into a structural document', async () => {
        const fetcher: typeof fetch = async (input) => {
            const url = new URL(String(input));
            if (url.pathname === '/v1/search') return json({ results: [{ id: 'page-1', url: 'https://notion.so/page-1', created_time: '2026-01-01T00:00:00Z', last_edited_time: '2026-07-01T00:00:00Z', properties: { Name: { type: 'title', title: [{ plain_text: 'Project Notes' }] } } }], has_more: false });
            if (url.pathname === '/v1/pages/page-1') return json({ id: 'page-1', url: 'https://notion.so/page-1', created_time: '2026-01-01T00:00:00Z', last_edited_time: '2026-07-01T00:00:00Z', properties: { Name: { type: 'title', title: [{ plain_text: 'Project Notes' }] } } });
            if (url.pathname === '/v1/blocks/page-1/children') return json({ results: [{ id: 'block-1', type: 'heading_1', heading_1: { rich_text: [{ plain_text: 'Decision' }] }, has_children: false }, { id: 'block-2', type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'Keep MCP tools high-level.' }] }, has_children: false }], has_more: false });
            throw new Error(`unexpected Notion request: ${url}`);
        };
        const connector = new notion_connector({ access_token: 'notion-token', fetch: fetcher });
        await connector.connect();
        const refs = await connector.listSources();
        const document = await connector.fetchSource(refs[0]);
        expect(refs[0].title).toBe('Project Notes');
        expect('content' in document && document.content).toContain('# Decision');
        expect('content' in document && document.content).toContain('Keep MCP tools high-level.');
    });

    it('replaces catalog stubs with native connector factories', () => {
        expect(default_connector_registry.load('pdf', { root: workspace() })).toBeInstanceOf(document_connector);
        expect(default_connector_registry.load('google_drive')).toBeInstanceOf(google_drive_connector);
        expect(default_connector_registry.load('notion')).toBeInstanceOf(notion_connector);
    });
});

describe('dashboard API support', () => {
    it('lists project worlds for dashboard discovery', async () => {
        const dir = workspace();
        const config = load_server_config({ OPENMEMORY_DB_PATH: join(dir, 'memory.db') });
        const server = create_open_memory_server({ config });
        servers.push(server);
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
        const address = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${address.port}/v1/worlds?limit=100`);
        const payload = await response.json() as { data: unknown[] };
        expect(response.status).toBe(200);
        expect(Array.isArray(payload.data)).toBe(true);
    });
});