import { Client as mcp_client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport as streamable_http_client_transport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { InMemoryTransport as in_memory_transport } from '@modelcontextprotocol/sdk/inMemory.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { create_memory } from '../src/core/create_memory.js';
import { create_openmemory_mcp, type mcp_server_config } from '../src/mcp/mcp_server.js';
import { create_mcp_http_handler } from '../src/mcp/transports/http.js';
import { create_stdio_mcp } from '../src/mcp/transports/stdio.js';
import { mcp_tool_names } from '../src/mcp/security/tool_allowlist.js';

const dirs: string[] = [];
const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
    await Promise.all(cleanups.splice(0).map((close) => close()));
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const database = () => {
    const dir = mkdtempSync(join(tmpdir(), 'openmemory-mcp-'));
    dirs.push(dir);
    return join(dir, 'memory.db');
};

async function fixture(config: mcp_server_config = {}) {
    const resolved_config = { env: {}, ...config };
    const mcp = create_openmemory_mcp(resolved_config);
    const [client_transport, server_transport] = in_memory_transport.createLinkedPair();
    const client = new mcp_client({ name: 'openmemory-phase27-test', version: '1.0.0' });
    await mcp.server.connect(server_transport);
    await client.connect(client_transport);
    const close = async () => {
        await client.close().catch(() => undefined);
        await mcp.server.close().catch(() => undefined);
        if (!resolved_config.runtime) await mcp.runtime.close();
    };
    cleanups.push(close);
    return { ...mcp, client, close };
}

const structured = (result: Awaited<ReturnType<mcp_client['callTool']>>) => result.structuredContent as Record<string, any>;

describe('phase 27 MCP integration', () => {
    it('1. starts the stdio MCP server without writing banners to protocol output', async () => {
        const input = new PassThrough();
        const output = new PassThrough();
        const mcp = create_stdio_mcp({}, input, output);
        await mcp.start();
        expect(mcp.server.isConnected()).toBe(true);
        expect(output.readableLength).toBe(0);
        await mcp.close();
    });

    it('2. starts a Streamable HTTP MCP server', async () => {
        const mcp = create_mcp_http_handler();
        const server = createServer(mcp.handler);
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
        const address = server.address() as AddressInfo;
        const client = new mcp_client({ name: 'http-test', version: '1.0.0' });
        await client.connect(new streamable_http_client_transport(new URL(`http://127.0.0.1:${address.port}/mcp`)));
        expect((await client.listTools()).tools).toHaveLength(8);
        await client.close().catch(() => undefined);
        await new Promise<void>((resolve) => server.close(() => resolve()));
        await mcp.close();
    });

    it('3. advertises only the eight high-level tools', async () => {
        const { client } = await fixture();
        expect((await client.listTools()).tools.map((tool) => tool.name).sort()).toEqual([...mcp_tool_names].sort());
    });

    it('4. returns structured project context', async () => {
        const { client } = await fixture({ project_id: 'alpha' });
        const result = await client.callTool({
            name: 'openmemory_project_context',
            arguments: { project_id: 'alpha', task: 'implement MCP', mode: 'coding', token_budget: 512 },
        });
        expect(structured(result)).toMatchObject({
            project_summary: 'OpenMemory project alpha',
            hard_constraints: [], active_decisions: [], open_tasks: [], conflicts: [],
        });
        expect(structured(result).debug_trace.within_budget).toBe(true);
    });

    it('5. routes strict, historical, associative, and grounded recall through core gates', async () => {
        const { client } = await fixture();
        await client.callTool({ name: 'openmemory_ingest', arguments: { text: 'The build uses pnpm', source: 'test' } });
        for (const mode of ['strict', 'historical', 'associative', 'world_grounded'] as const) {
            const result = await client.callTool({ name: 'openmemory_recall', arguments: { query: 'build pnpm', mode, token_budget: 256 } });
            expect(result.isError).not.toBe(true);
            expect(result.content[0]).toMatchObject({ type: 'text' });
        }
    });

    it('6. persists remembered decisions across SQLite reopen', async () => {
        const db_path = database();
        const first = await fixture({ db_path, project_id: 'alpha' });
        const written = await first.client.callTool({
            name: 'openmemory_remember_decision',
            arguments: { project_id: 'alpha', decision: 'Use SQLite WAL', reason: 'Atomic local persistence' },
        });
        expect(structured(written).memory_id).toBeTruthy();
        await first.close();
        cleanups.splice(cleanups.indexOf(first.close), 1);
        const second = await fixture({ db_path, project_id: 'alpha' });
        const resource = await second.client.readResource({ uri: 'openmemory://project/alpha/decisions' });
        expect(resource.contents[0]).toMatchObject({ mimeType: 'application/json' });
        expect(JSON.parse((resource.contents[0] as { text: string }).text)[0].decision).toBe('Use SQLite WAL');
    });

    it('7. updates durable task and agent continuity state', async () => {
        const { client } = await fixture({ project_id: 'alpha' });
        const result = await client.callTool({
            name: 'openmemory_update_task_state',
            arguments: { project_id: 'alpha', task: 'Add MCP', status: 'blocked', errors_seen: ['schema mismatch'], next_steps: ['fix schema'] },
        });
        expect(structured(result)).toMatchObject({ project_id: 'alpha', status: 'blocked' });
        const tasks = await client.readResource({ uri: 'openmemory://project/alpha/tasks' });
        expect(JSON.parse((tasks.contents[0] as { text: string }).text)[0]).toMatchObject({ task: 'Add MCP', status: 'blocked' });
    });

    it('8. lists and reads all required resource kinds', async () => {
        const { client } = await fixture({ project_id: 'alpha' });
        await client.callTool({ name: 'openmemory_project_context', arguments: { project_id: 'alpha', task: 'inspect', mode: 'review' } });
        const resources = await client.listResources();
        const templates = await client.listResourceTemplates();
        expect(resources.resources.map((resource) => resource.uri)).toContain('openmemory://projects');
        expect(templates.resourceTemplates.map((resource) => resource.uriTemplate).sort()).toEqual([
            'openmemory://entity/{entity_id}', 'openmemory://memory/{node_id}',
            'openmemory://project/{project_id}/conflicts', 'openmemory://project/{project_id}/current-context',
            'openmemory://project/{project_id}/decisions', 'openmemory://project/{project_id}/summary',
            'openmemory://project/{project_id}/tasks', 'openmemory://world/{world_id}',
        ].sort());
        const summary = await client.readResource({ uri: 'openmemory://project/alpha/summary' });
        expect(JSON.parse((summary.contents[0] as { text: string }).text).project_id).toBe('alpha');
    });

    it('9. lists the five workflow prompts with injection-safe instructions', async () => {
        const { client } = await fixture();
        const prompts = await client.listPrompts();
        expect(prompts.prompts.map((prompt) => prompt.name).sort()).toEqual([
            'openmemory_after_coding', 'openmemory_architecture_context', 'openmemory_before_coding',
            'openmemory_debug_session', 'openmemory_project_handoff',
        ]);
        const prompt = await client.getPrompt({ name: 'openmemory_before_coding', arguments: { project_id: 'alpha', task: 'build' } });
        expect((prompt.messages[0].content as { text: string }).text).toContain('untrusted quoted data');
    });

    it('10. blocks write tools in read-only mode', async () => {
        const { client, runtime } = await fixture({ read_only: true });
        const result = await client.callTool({ name: 'openmemory_ingest', arguments: { text: 'blocked', source: 'test' } });
        expect(result.isError).toBe(true);
        expect(runtime.audit.entries().at(-1)).toMatchObject({ tool: 'openmemory_ingest', outcome: 'denied' });
    });

    it('11. filters permission-denied memory from recall', async () => {
        const memory = create_memory();
        const private_result = await memory.ingest({
            user_id: 'other', text: 'private launch code is zephyr',
            contract: { privacy_level: 'private', source_permission: { scope: 'user_only', user_ids: ['other'], team_ids: [], project_ids: [], source_id: null } },
        });
        const { client } = await fixture({ memory, user_id: 'agent' });
        const result = await client.callTool({ name: 'openmemory_recall', arguments: { query: 'launch zephyr', mode: 'strict' } });
        expect(JSON.stringify(structured(result))).not.toContain(private_result.node.id);
        await memory.close();
    });

    it('12. audit logs allowed, denied, and failed tool calls', async () => {
        const { client, runtime } = await fixture({ project_id: 'alpha' });
        await client.callTool({ name: 'openmemory_project_context', arguments: { project_id: 'alpha', task: 'audit', mode: 'review' } });
        await client.callTool({ name: 'openmemory_explain', arguments: { memory_id: 'missing' } });
        expect(runtime.audit.entries().map((entry) => entry.tool)).toEqual(['openmemory_project_context', 'openmemory_explain']);
        expect(runtime.audit.entries().every((entry) => entry.completed_at >= entry.started_at)).toBe(true);
    });

    it('13. keeps project context retrieval within the requested token budget', async () => {
        const { client } = await fixture({ project_id: 'alpha' });
        for (let index = 0; index < 12; index++) {
            await client.callTool({
                name: 'openmemory_ingest',
                arguments: { project_id: 'alpha', text: `Architecture note ${index} ${'detail '.repeat(30)}`, source: 'test', memory_type: 'architecture' },
            });
        }
        const result = await client.callTool({
            name: 'openmemory_project_context',
            arguments: { project_id: 'alpha', task: 'architecture', mode: 'planning', token_budget: 128 },
        });
        expect(structured(result).debug_trace).toMatchObject({ token_budget: 128, within_budget: true });
        expect(structured(result).debug_trace.tokens_used).toBeLessThanOrEqual(128);
    });
});