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
 *  file  : tests/phase24_connectors.test.ts
 *  usage : verifies LongMemory phase24 connectors.test behavior
 */

import { describe, expect, it } from 'vitest';
import { createMemory as create_memory } from '../src/index.js';
import { sync_connector } from '../src/core/connectors/connector_ingest.js';
import { public_permission, type connector_permission } from '../src/core/connectors/permission.js';
import type { SourceDocument, SourceRef } from '../src/core/connectors/source_document.js';
import type { ConnectorSyncItem, HydrographImportPlan, connector_map_context } from '../src/core/connectors/source_event.js';
import { ConnectorRegistry } from '../src/core/connectors/connector_registry.js';
import { docs_connector } from '../src/connectors/docs/docs_connector.js';
import { map_chat_to_hydrograph, map_email_to_hydrograph, map_issue_tracker_to_hydrograph, map_pdf_to_hydrograph } from '../src/connectors/domain_mapper.js';
import { map_github_to_hydrograph } from '../src/connectors/github/github_mapper.js';
import { mock_connector } from '../src/connectors/mock_connector.js';
import { connector_definitions, default_connector_registry } from '../src/connectors/registry.js';
import { youtube_connector } from '../src/connectors/youtube/youtube_connector.js';

const jan = Date.UTC(2026, 0, 1);
const mar = Date.UTC(2026, 2, 1);
const apr = Date.UTC(2026, 3, 1);

const document = (over: Partial<SourceDocument> = {}): SourceDocument => ({
    id: 'doc:v1',
    source_type: 'document',
    external_id: 'doc-1',
    url: 'https://docs.example/doc-1',
    title: 'Project handbook',
    author: 'Alice Chen',
    created_at: jan,
    updated_at: jan,
    fetched_at: jan + 100,
    content: '# Overview\n\nThe project prefers safe migrations.\n\n## Operations\n\nDeploy on Fridays.',
    metadata: {},
    permissions: public_permission(),
    version: 'v1',
    checksum: 'checksum-v1',
    ...over,
});

const ref = (doc: SourceDocument, kind: SourceRef['kind'] = 'document'): SourceRef => ({
    source_type: doc.source_type,
    external_id: doc.external_id,
    kind,
    title: doc.title,
    url: doc.url,
    parent_external_id: null,
    version: doc.version,
    checksum: doc.checksum,
    updated_at: doc.updated_at,
    metadata: doc.metadata,
});

const event = (doc: SourceDocument, kind: SourceRef['kind'], event_kind: ConnectorSyncItem['event'] = 'created'): ConnectorSyncItem => ({
    id: `${doc.source_type}:${event_kind}:${doc.external_id}:${doc.checksum}`,
    source_type: doc.source_type,
    external_id: doc.external_id,
    event: event_kind,
    recorded_at: doc.fetched_at,
    ref: ref(doc, kind),
    document: doc,
    previous_checksum: null,
    metadata: {},
});

const context = (connector_id: string, source_type: string, previous: connector_map_context['previous'] = null): connector_map_context => ({
    connector_id,
    source_type,
    now: apr,
    previous,
    default_permission: public_permission(),
});

describe('phase 24 connector framework', () => {
    it('1. registers and loads connector implementations', () => {
        expect(default_connector_registry.list()).toEqual(expect.arrayContaining(['youtube', 'github', 'docs', 'markdown', 'pdf', 'website', 'notion', 'discord', 'slack', 'jira', 'linear', 'email', 'local', 'generic_api']));
        const registry = new ConnectorRegistry().register('fixture', () => new mock_connector('fixture', 'Fixture', 'fixture'));
        const loaded = registry.load('fixture');
        expect(loaded).toMatchObject({ id: 'fixture', name: 'Fixture', source_type: 'fixture' });
    });

    it('2. maps mock source items into plans without writing memory', async () => {
        const connector = new mock_connector('fixture', 'Fixture', 'fixture');
        const doc = document({ source_type: 'fixture' });
        await connector.connect({ documents: [doc] });
        const item = (await Array.fromAsync(connector.sync({ mode: 'full', cursor: null })))[0];
        const plan = await connector.mapToHydrograph(item, context('fixture', 'fixture'));
        expect(plan.nodes_to_create.length).toBeGreaterThan(1);
        expect(plan.edges_to_create.some((edge) => edge.type === 'contains')).toBe(true);
        expect(plan.worlds_to_create).toHaveLength(1);
        expect(plan.provenance.every((entry) => entry.external_id === doc.external_id)).toBe(true);
    });

    it('3. imports a YouTube video world with timestamped transcript segments', async () => {
        const video = document({
            id: 'youtube:v1', source_type: 'youtube', external_id: 'vid-1', title: 'Hydrograph internals',
            url: 'https://youtube.com/watch?v=vid-1', author: 'Cavira Channel', checksum: 'video-v1', version: 'v1',
            metadata: {
                channel: 'Cavira Channel', topics: ['Hydrograph', 'Memory'], duration_seconds: 120,
                transcript: [
                    { start_seconds: 0, duration_seconds: 12, text: 'Welcome to Hydrograph.', speaker: 'Ada' },
                    { start_seconds: 12, duration_seconds: 18, text: 'Connectors preserve provenance.', speaker: 'Ada' },
                ],
            },
        });
        const connector = new youtube_connector();
        await connector.connect({ videos: [video] });
        const memory = await create_memory();
        const report = await sync_connector(connector, memory, { mode: 'full' });
        const worlds = await memory.listWorlds({ zone: 'exocortex' });
        const explanations = await Promise.all(report.node_ids.map((id) => memory.explain(id)));
        const segment = explanations.find((item) => item.node?.content.raw === 'Connectors preserve provenance.');
        const root = explanations.find((item) => item.node?.metadata?.video_root === true);
        expect(worlds.some((world) => world.name === 'Hydrograph internals')).toBe(true);
        expect(segment?.node?.metadata?.timestamp_seconds).toBe(12);
        expect(segment?.node?.metadata?.url).toContain('t=12s');
        expect(root?.outgoing_edges.filter((edge) => edge.type === 'contains')).toHaveLength(2);
        expect((await memory.getStats()).entities).toBeGreaterThanOrEqual(4);
        await memory.close();
    });

    it('4. maps a GitHub repo into project worlds with issue, PR, commit, and file relations', async () => {
        const memory = await create_memory();
        const issue_doc = document({ source_type: 'github', external_id: 'github:repo:issue:12', title: 'Broken migration', content: 'Migration is broken', checksum: 'issue-1', metadata: { source_item: { kind: 'issue', metadata: { number: 12 } }, comments: [{ id: 1, body: 'Reproduced', user: { login: 'Ada' }, created_at: '2026-01-01T00:00:00Z' }] } });
        const pr_doc = document({ source_type: 'github', external_id: 'github:repo:pull_request:7', title: 'Fix migration', content: 'Fixes #12', checksum: 'pr-1', metadata: { source_item: { kind: 'pull_request', metadata: { number: 7 } }, pull: { body: 'Fixes #12' } } });
        const commit_doc = document({ source_type: 'github', external_id: 'github:repo:commit:abc', title: 'fix: migration', content: 'fix: migration', checksum: 'commit-1', metadata: { source_item: { kind: 'commit', metadata: { sha: 'abc' } }, commit: { files: [{ filename: 'src/migrate.ts', additions: 4, deletions: 1, status: 'modified' }] } } });
        const readme_doc = document({ source_type: 'github', external_id: 'github:repo:file:README.md', title: 'README.md', content: '# LongMemory\nHydrograph memory.', checksum: 'readme-1', metadata: { source_item: { kind: 'file', path: 'README.md', metadata: { sha: 'readme' } } } });
        const plans = await Promise.all([
            map_github_to_hydrograph('github', event(issue_doc, 'issue'), context('github', 'github'), 'CaviraOSS/LongMemory'),
            map_github_to_hydrograph('github', event(pr_doc, 'pull_request'), context('github', 'github'), 'CaviraOSS/LongMemory'),
            map_github_to_hydrograph('github', event(commit_doc, 'commit'), context('github', 'github'), 'CaviraOSS/LongMemory'),
            map_github_to_hydrograph('github', event(readme_doc, 'file'), context('github', 'github'), 'CaviraOSS/LongMemory'),
        ]);
        const results = [];
        for (const plan of plans) results.push(await memory.applyImportPlan(plan));
        const ids = results.flatMap((result) => result.node_ids);
        const explanations = await Promise.all(ids.map((id) => memory.explain(id)));
        const edges = explanations.flatMap((item) => [...item.incoming_edges, ...item.outgoing_edges]);
        expect((await memory.listWorlds()).some((world) => world.name === 'CaviraOSS/LongMemory')).toBe(true);
        expect(explanations.some((item) => item.node?.metadata?.issue_comment === true)).toBe(true);
        expect(edges.some((edge) => edge.type === 'supports' && edge.handler.params.relation === 'fixes')).toBe(true);
        expect(edges.some((edge) => edge.type === 'refers_to' && edge.handler.params.relation === 'modifies')).toBe(true);
        expect(edges.some((edge) => edge.type === 'grounds')).toBe(true);
        await memory.close();
    });

    it('5. creates supersession edges when a document changes', async () => {
        const connector = new docs_connector();
        const memory = await create_memory();
        const first = document();
        await connector.connect({ documents: [first] });
        const initial = await sync_connector(connector, memory, { mode: 'incremental' });
        const old_section = initial.node_ids.find(async (id) => (await memory.explain(id)).node?.content.raw.includes('safe migrations')) ?? initial.node_ids[0];
        const updated = document({ id: 'doc:v2', updated_at: mar, fetched_at: mar + 100, version: 'v2', checksum: 'checksum-v2', content: '# Overview\n\nThe project prefers reversible migrations.' });
        await connector.connect({ documents: [updated] });
        const changed = await sync_connector(connector, memory, { mode: 'incremental' });
        const old = await memory.explain(initial.node_ids[0]);
        expect(changed.updated).toBe(1);
        expect(old.incoming_edges.some((edge) => edge.type === 'supersedes')).toBe(true);
        expect(old.node?.state.status).toBe('superseded');
        expect(old_section).toBeTruthy();
        await memory.close();
    });

    it('6. preserves deleted external data historically instead of erasing it', async () => {
        const connector = new docs_connector();
        const memory = await create_memory();
        await connector.connect({ documents: [document()] });
        const initial = await sync_connector(connector, memory, { mode: 'incremental' });
        await connector.connect({ documents: [] });
        const removed = await sync_connector(connector, memory, { mode: 'incremental' });
        const old = await memory.explain(initial.node_ids[0]);
        const historical = await memory.recall({ text: 'Project handbook', mode: 'historical', now: apr, valid_time: jan + 1 });
        expect(removed.deleted).toBe(1);
        expect(old.node).not.toBeNull();
        expect(old.node?.state.status).toBe('superseded');
        expect('timeline' in historical && historical.timeline.entries.some((entry) => entry.id === old.node?.id)).toBe(true);
        await memory.close();
    });

    it('7. blocks permission-restricted memories from unauthorized recall', async () => {
        const permission: connector_permission = { scope: 'project', user_ids: [], team_ids: [], project_ids: ['project-1'], source_id: 'docs', inherited: false, raw: {} };
        const connector = new docs_connector();
        await connector.connect({ documents: [document({ content: '# Secret roadmap\n\nLaunch is Friday.', permissions: permission })] });
        const memory = await create_memory();
        await sync_connector(connector, memory, { mode: 'full' });
        const denied = await memory.recall({ text: 'secret roadmap launch', mode: 'strict', now: apr });
        const allowed = await memory.recall({ text: 'secret roadmap launch', mode: 'strict', now: apr, permission_context: { project_ids: ['project-1'] } });
        expect('items' in denied && denied.items).toHaveLength(0);
        expect('items' in allowed && allowed.items.length).toBeGreaterThan(0);
        await memory.close();
    });

    it('8. resolves connector entities through the shared resolver', async () => {
        const video = document({ source_type: 'youtube', external_id: 'entity-video', title: 'Alice Chen on Memory', author: 'Cavira Channel', checksum: 'entity-v1', metadata: { channel: 'Cavira Channel', topics: ['Hydrograph'], transcript: [{ start_seconds: 0, duration_seconds: 5, text: 'Alice Chen explains Hydrograph.', speaker: 'Alice Chen' }] } });
        const connector = new youtube_connector();
        await connector.connect({ videos: [video] });
        const memory = await create_memory();
        await sync_connector(connector, memory, { mode: 'full' });
        const resolved = await memory.resolveEntity({ name: 'Alice Chen', observed_at: apr });
        expect(resolved.action).toBe('resolved');
        expect(resolved.entity.canonical_name).toBe('Alice Chen');
        await memory.close();
    });

    it('9. creates durable connector provenance for every imported node', async () => {
        const connector = new docs_connector();
        await connector.connect({ documents: [document()] });
        const memory = await create_memory();
        const report = await sync_connector(connector, memory, { mode: 'full' });
        for (const id of report.node_ids) {
            const node = (await memory.explain(id)).node!;
            expect(node.provenance.source_trace.length).toBeGreaterThan(0);
            expect(node.metadata.connector_provenance).toMatchObject({ connector_id: 'docs', source_type: 'document', external_id: 'doc-1' });
        }
        await memory.close();
    });

    it('10. resumes incremental sync from checksum cursor state', async () => {
        const connector = new docs_connector();
        await connector.connect({ documents: [document()] });
        const memory = await create_memory();
        const first = await sync_connector(connector, memory, { mode: 'incremental' });
        const second = await sync_connector(connector, memory, { mode: 'incremental' });
        expect(first.created).toBe(1);
        expect(second.unchanged).toBe(1);
        expect(second.applied_plans).toBe(0);
        expect((await connector.getCursor())?.items['doc-1'].checksum).toBe('checksum-v1');
        await memory.close();
    });

    it('11. dry-run reports plans without mutating memory or cursor', async () => {
        const connector = new docs_connector();
        await connector.connect({ documents: [document()] });
        const memory = await create_memory();
        const report = await sync_connector(connector, memory, { mode: 'full', dry_run: true });
        expect(report.plans).toHaveLength(1);
        expect(report.applied_plans).toBe(0);
        expect((await memory.getStats()).nodes).toBe(0);
        expect(await connector.getCursor()).toBeNull();
        await memory.close();
    });

    it('12. rolls back a failed connector item without corrupting graph state', async () => {
        class broken_connector extends mock_connector {
            override async mapToHydrograph(item: ConnectorSyncItem, map_context: connector_map_context): Promise<HydrographImportPlan> {
                const plan = await super.mapToHydrograph(item, map_context);
                plan.edges_to_create.push({ key: 'broken', from: 'document', to: 'missing-node', type: 'contains', confidence: 1, weight: 1, valid_from: jan, valid_to: null, observed_at: jan, recorded_at: jan, metadata: {} });
                return plan;
            }
        }
        const connector = new broken_connector('broken', 'Broken', 'broken');
        await connector.connect({ documents: [document({ source_type: 'broken' })] });
        const memory = await create_memory();
        const before = await memory.getStats();
        const report = await sync_connector(connector, memory, { mode: 'full', retry_failed: 1 });
        const after = await memory.getStats();
        expect(report.failures).toEqual([expect.objectContaining({ attempts: 2 })]);
        expect(after.nodes).toBe(before.nodes);
        expect(after.edges).toBe(before.edges);
        expect(after.worlds).toBe(before.worlds);
        await memory.close();
    });

    it('13. exposes one expanded connector registry without a parallel source catalog', () => {
        expect(connector_definitions.length).toBeGreaterThanOrEqual(50);
        expect(default_connector_registry.list()).toHaveLength(connector_definitions.length);
        expect(connector_definitions.find((item) => item.id === 'slack')?.status).toBe('configurable');
        expect(connector_definitions.find((item) => item.id === 'jira')?.status).toBe('configurable');
        expect(connector_definitions.find((item) => item.id === 'google_drive')?.status).toBe('real');
        expect(connector_definitions.find((item) => item.id === 'website')?.status).toBe('real');
        expect(connector_definitions.find((item) => item.id === 'pdf')?.status).toBe('real');
        expect(default_connector_registry.load('slack', {
            list_url: 'https://slack.example/api/messages',
            item_url: 'https://slack.example/api/messages/{id}',
            response_path: 'messages',
            fields: { id: 'id', name: 'text', text: 'text' },
        })).toMatchObject({ id: 'slack', source_type: 'slack' });
    });

    it('14. maps Jira and Linear-style issues, comments, and transitions', async () => {
        const issue = document({
            source_type: 'issue_tracker', external_id: 'OPS-42', title: 'Migration fails', content: 'Migration fails on Windows', checksum: 'issue-v1',
            metadata: { payload: { project: { name: 'Operations' }, status: { name: 'In Progress' }, priority: 'High', creator: { displayName: 'Alice Chen' }, assignee: { displayName: 'Bob Stone' }, comments: [{ id: 'c1', body: 'Reproduced on CI', author: { displayName: 'Carol Jones' }, created_at: '2026-01-02T00:00:00Z' }], transitions: [{ id: 't1', summary: 'Open -> In Progress' }] } },
        });
        const memory = await create_memory();
        const plan = await map_issue_tracker_to_hydrograph('jira', event(issue, 'issue'), context('jira', 'issue_tracker'));
        const result = await memory.applyImportPlan(plan);
        const explanations = await Promise.all(result.node_ids.map((id) => memory.explain(id)));
        expect((await memory.listWorlds()).some((world) => world.name === 'Operations')).toBe(true);
        expect(explanations.some((item) => item.node?.metadata.issue_comment === true)).toBe(true);
        expect(explanations.some((item) => item.node?.metadata.status_transition === true)).toBe(true);
        expect(explanations.flatMap((item) => item.outgoing_edges).some((edge) => edge.type === 'contains')).toBe(true);
        expect((await memory.getStats()).entities).toBeGreaterThanOrEqual(4);
        await memory.close();
    });

    it('15. maps Slack and Discord-style workspaces, channels, threads, and authors', async () => {
        const message = document({
            source_type: 'slack', external_id: 'msg-1', title: 'Deployment thread', content: 'Can we deploy Friday?', checksum: 'msg-v1', author: 'Alice Chen',
            metadata: { payload: { workspace_name: 'Cavira', channel_name: 'platform', thread_id: 'thread-1', author: { display_name: 'Alice Chen' }, replies: [{ id: 'r1', text: 'Yes, after the migration.', author: { display_name: 'Bob Stone' }, created_at: '2026-01-02T00:00:00Z' }] } },
        });
        const memory = await create_memory();
        const plan = await map_chat_to_hydrograph('slack', event(message, 'message'), context('slack', 'slack'));
        const result = await memory.applyImportPlan(plan);
        const worlds = await memory.listWorlds();
        const explanations = await Promise.all(result.node_ids.map((id) => memory.explain(id)));
        expect(worlds.some((world) => world.name === 'Cavira')).toBe(true);
        expect(worlds.some((world) => world.name === 'platform')).toBe(true);
        expect(explanations.some((item) => item.node?.metadata.thread_reply === true)).toBe(true);
        expect(explanations.flatMap((item) => item.outgoing_edges).some((edge) => edge.type === 'contains')).toBe(true);
        await memory.close();
    });

    it('16. maps email threads and PDF pages with participants and citations', async () => {
        const email = document({ source_type: 'email', external_id: 'mail-1', title: 'Migration review', content: 'Please review the migration.', checksum: 'mail-v1', author: 'Alice Chen', metadata: { mailbox: 'Inbox', thread_id: 'thread-1', to: ['Bob Stone'], cc: ['Carol Jones'], message_id: '<mail-1@example.test>' } });
        const pdf = document({ source_type: 'pdf', external_id: 'pdf-1', title: 'Migration manual', content: '', checksum: 'pdf-v1', metadata: { pages: [{ page: 1, text: 'Migration overview', headings: ['Overview'] }, { page: 2, text: 'Rollback procedure', headings: ['Rollback'] }] } });
        const memory = await create_memory();
        const email_result = await memory.applyImportPlan(await map_email_to_hydrograph('email', event(email, 'message'), context('email', 'email')));
        const pdf_result = await memory.applyImportPlan(await map_pdf_to_hydrograph('pdf', event(pdf, 'document'), context('pdf', 'pdf')));
        const email_node = (await memory.explain(email_result.node_ids[0])).node;
        const pdf_nodes = await Promise.all(pdf_result.node_ids.map((id) => memory.explain(id)));
        expect(email_node?.metadata.thread_id).toBe('thread-1');
        expect((await memory.getStats()).entities).toBeGreaterThanOrEqual(3);
        expect(pdf_nodes.filter((item) => typeof item.node?.metadata.page === 'number')).toHaveLength(2);
        expect(pdf_nodes.some((item) => item.node?.metadata.citation && (item.node.metadata.citation as { page?: number }).page === 2)).toBe(true);
        expect(pdf_nodes.flatMap((item) => item.outgoing_edges).filter((edge) => edge.type === 'contains')).toHaveLength(2);
        await memory.close();
    });

    it('17. syncs a configured Slack transport through the unified registry', async () => {
        const fetcher: typeof fetch = async (input) => {
            const path = new URL(String(input)).pathname;
            const value = path.endsWith('/messages')
                ? { messages: [{ id: 'm1', text: 'Deploy Friday?', url: 'https://slack.test/m1' }] }
                : { id: 'm1', text: 'Deploy Friday?', url: 'https://slack.test/m1', workspace_name: 'Cavira', channel_name: 'platform', author: { display_name: 'Alice Chen' }, replies: [{ id: 'r1', text: 'After migration.', author: { display_name: 'Bob Stone' } }] };
            return new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
        };
        const connector = default_connector_registry.load('slack', {
            list_url: 'https://slack.test/messages', item_url: 'https://slack.test/messages/{id}', response_path: 'messages',
            fields: { id: 'id', name: 'text', text: 'text', uri: 'url' }, fetch: fetcher,
        });
        await connector.connect();
        const memory = await create_memory();
        const report = await sync_connector(connector, memory, { mode: 'full', retry_failed: 0 });
        expect(report.failures).toEqual([]);
        expect(report.node_ids.length).toBeGreaterThanOrEqual(2);
        expect((await memory.listWorlds()).map((world) => world.name)).toEqual(expect.arrayContaining(['Cavira', 'platform']));
        const nodes = await Promise.all(report.node_ids.map((id) => memory.explain(id)));
        expect(nodes.some((item) => item.node?.metadata.thread_reply === true)).toBe(true);
        await memory.close();
    });
});