import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createMemory as create_memory, createProjectMemory } from '../src/index.js';
import { docs_connector } from '../src/connectors/docs/docs_connector.js';
import { mock_connector } from '../src/connectors/mock_connector.js';
import { public_permission } from '../src/core/connectors/permission.js';
import type { SourceDocument } from '../src/core/connectors/source_document.js';

const jan = Date.UTC(2026, 0, 1);
const mar = Date.UTC(2026, 2, 1);
const apr = Date.UTC(2026, 3, 1);
const dirs: string[] = [];

afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const config = (project_id = 'alpha') => ({
    tenant_id: 'tenant-1',
    organization_id: 'cavira',
    project_id,
    name: `Project ${project_id}`,
    description: `${project_id} long-running memory project`,
    created_at: jan,
});

const source_document = (over: Partial<SourceDocument> = {}): SourceDocument => ({
    id: 'doc-1:v1', source_type: 'document', external_id: 'doc-1', url: 'https://docs.test/doc-1', title: 'Architecture guide',
    author: 'Alice Chen', created_at: jan, updated_at: jan, fetched_at: jan + 100,
    content: '# Architecture\n\nThe API uses Fastify.', metadata: {}, permissions: public_permission(), version: 'v1', checksum: 'doc-v1', ...over,
});

describe('phase 25 project-wide agent memory', () => {
    it('1. creates a recursive ProjectWorld hierarchy', async () => {
        const manager = await createProjectMemory(config());
        const project = manager.getProject('alpha');
        const root = await manager.memory.getWorld(project.root_world_id);
        expect(root?.metadata).toMatchObject({ hierarchy: 'project', project_id: 'alpha' });
        expect(Object.values(project.world_ids).every(Boolean)).toBe(true);
        expect((await manager.memory.getWorld(project.world_ids.repositories))?.parent_world_id).toBe(project.root_world_id);
        expect((await manager.memory.getWorld(project.world_ids.agent_sessions))?.zone).toBe('endocortex');
        await manager.close();
    });

    it('2. links and syncs a GitHub mock repository under the project', async () => {
        const manager = await createProjectMemory(config());
        const github = new mock_connector('github', 'GitHub mock', 'github', 'repository');
        await manager.linkSourceToProject('alpha', {
            connector_id: 'github', connector: github, label: 'CaviraOSS/OpenMemory', current_ref: 'abc123',
            config: { documents: [source_document({ source_type: 'github', external_id: 'repo-1', title: 'CaviraOSS/OpenMemory', content: '# OpenMemory\nProject repository.', metadata: { repository: 'CaviraOSS/OpenMemory', commit: 'abc123' } })] },
        });
        const report = await manager.syncProjectSource('alpha', 'github');
        const node = (await manager.explainProjectMemory('alpha', report.node_ids[0])).node;
        const world = await manager.memory.getWorld(node!.world.world_id);
        expect(report.failures).toEqual([]);
        expect(node?.metadata.project_id).toBe('alpha');
        expect(world?.scope_path).toContain('repositories');
        expect(manager.getProject('alpha').linked_sources[0]).toMatchObject({ connector_id: 'github', current_ref: 'abc123' });
        expect(await manager.listAssets('alpha')).toEqual([expect.objectContaining({ type: 'code_graph', status: 'candidate', source_ref: 'abc123' })]);
        await manager.close();
    });

    it('3. links and syncs a docs mock source into document worlds', async () => {
        const manager = await createProjectMemory(config());
        const docs = new docs_connector();
        await manager.linkSourceToProject('alpha', { connector_id: 'docs', connector: docs, config: { documents: [source_document()] } });
        const report = await manager.syncProjectSource('alpha', 'docs');
        const worlds = await manager.memory.listWorlds();
        expect(report.node_ids.length).toBeGreaterThan(1);
        expect(worlds.some((world) => world.name === 'Architecture guide' && world.parent_world_id === manager.getProject('alpha').world_ids.documents)).toBe(true);
        expect(await manager.listAssets('alpha')).toEqual([expect.objectContaining({ type: 'llm_wiki', status: 'candidate' })]);
        await manager.close();
    });

    it('4. ingests a source-backed project architecture note', async () => {
        const manager = await createProjectMemory(config());
        const id = await manager.ingestProjectEvent('alpha', {
            kind: 'architecture', topic: 'database', text: 'Project database is SQLite', at: jan,
            source_type: 'architecture_note', external_id: 'architecture.md:v1', url: 'file:///architecture.md', source_id: 'architecture.md',
        });
        const explanation = await manager.explainProjectMemory('alpha', id);
        expect(explanation.node?.world.world_id).toBe(manager.getProject('alpha').world_ids.architecture);
        expect(explanation.node?.world.zone).toBe('exocortex');
        expect(explanation.node?.metadata.citation).toMatchObject({ external_id: 'architecture.md:v1', url: 'file:///architecture.md' });
        await manager.close();
    });

    it('5. supersedes changed architecture instead of mutating it', async () => {
        const manager = await createProjectMemory(config());
        const old_id = await manager.ingestProjectEvent('alpha', { kind: 'architecture', topic: 'database', text: 'Project database is SQLite', at: jan, source_type: 'document', external_id: 'arch-v1' });
        const current_id = await manager.ingestProjectEvent('alpha', { kind: 'architecture', topic: 'database', text: 'Project database is Postgres', at: mar, source_type: 'document', external_id: 'arch-v2' });
        const old = await manager.explainProjectMemory('alpha', old_id);
        expect(old.node?.state.status).toBe('superseded');
        expect(old.incoming_edges.some((edge) => edge.type === 'supersedes' && edge.from === current_id)).toBe(true);
        expect(manager.getProject('alpha').current_architecture_summary).toBe('Project database is Postgres');
        await manager.close();
    });

    it('6. recalls only current architecture in project strict mode', async () => {
        const manager = await createProjectMemory(config());
        await manager.ingestProjectEvent('alpha', { kind: 'architecture', topic: 'database', text: 'Project database is SQLite', at: jan, source_type: 'document' });
        await manager.ingestProjectEvent('alpha', { kind: 'architecture', topic: 'database', text: 'Project database is Postgres', at: mar, source_type: 'document' });
        const result = await manager.recallProject('alpha', { text: 'Project database', now: apr }, 'project_strict');
        expect(result.memories.map((item) => item.node.content.raw)).toContain('Project database is Postgres');
        expect(result.memories.map((item) => item.node.content.raw)).not.toContain('Project database is SQLite');
        await manager.close();
    });

    it('7. historical project recall returns old architecture', async () => {
        const manager = await createProjectMemory(config());
        await manager.ingestProjectEvent('alpha', { kind: 'architecture', topic: 'database', text: 'Project database is SQLite', at: jan, source_type: 'document' });
        await manager.ingestProjectEvent('alpha', { kind: 'architecture', topic: 'database', text: 'Project database is Postgres', at: mar, source_type: 'document' });
        const result = await manager.recallProject('alpha', { text: 'Project database', now: apr, valid_time: jan + 1 }, 'project_historical');
        expect(result.memories.map((item) => item.node.content.raw)).toContain('Project database is SQLite');
        await manager.close();
    });

    it('8. builds an agent handoff with task, files, failures, and next steps', async () => {
        const manager = await createProjectMemory(config());
        await manager.ingestProjectEvent('alpha', { kind: 'goal', text: 'Finish connector migration', topic: 'release', at: jan, subjective: true });
        await manager.ingestProjectEvent('alpha', { kind: 'constraint', text: 'Do not bypass Hydrograph plans', at: jan, source_type: 'user_message' });
        await manager.ingestProjectEvent('alpha', { kind: 'code_fact', text: 'Project exports createProjectMemory from src/index.ts', topic: 'src/index.ts', at: jan, source_type: 'github', repo: 'CaviraOSS/OpenMemory', branch: 'main', commit: 'abc123', file_path: 'src/index.ts', line_start: 30, line_end: 35, checksum: 'file-1' });
        await manager.ingestProjectEvent('alpha', { kind: 'failure', text: 'Previous fix failed because cursor state was overwritten', at: mar, subjective: true });
        await manager.ingestProjectEvent('alpha', { kind: 'agent_state', topic: 'Implement project memory', text: 'Agent is implementing project memory', at: mar, subjective: true, files_touched: ['src/core/project/project_memory.ts'], alternatives_rejected: ['Global unscoped memory'], next_actions: ['Run project acceptance tests'], metadata: { current_plan: ['Implement APIs', 'Validate isolation'], known_failures: ['Cursor overwrite regression'], test_results: ['Connector tests passed'] } });
        const packet = await manager.getProjectContext('alpha', 'continue implementing project memory', 800);
        expect(packet.current_goal).toBe('Finish connector migration');
        expect(packet.relevant_files.some((file) => file.path === 'src/index.ts')).toBe(true);
        expect(packet.known_failures).toEqual(expect.arrayContaining(['Previous fix failed because cursor state was overwritten', 'Cursor overwrite regression']));
        expect(packet.suggested_next_steps).toContain('Run project acceptance tests');
        expect(packet.debug_trace).toMatchObject({ within_budget: true, token_budget: 800 });
        await manager.close();
    });

    it('9. surfaces contradictory project documents instead of hiding conflict', async () => {
        const manager = await createProjectMemory(config());
        await manager.ingestProjectEvent('alpha', { kind: 'architecture', topic: 'doc-a', text: 'Project database is SQLite', at: jan, source_type: 'document', replace_current: false });
        await manager.ingestProjectEvent('alpha', { kind: 'architecture', topic: 'doc-b', text: 'Project database is Postgres', at: mar, source_type: 'issue', replace_current: false });
        const result = await manager.recallProject('alpha', { text: 'Project database', now: apr }, 'project_associative');
        expect(result.contradictions.length).toBeGreaterThanOrEqual(1);
        expect(result.contradictions[0].warning).toContain('unresolved project contradiction');
        await manager.close();
    });

    it('10. prevents Project A memory from leaking into Project B', async () => {
        const shared = await create_memory();
        const manager = await createProjectMemory({ ...config('alpha'), memory: shared });
        await manager.createProject(config('beta'));
        await manager.ingestProjectEvent('alpha', { kind: 'manual_fact', text: 'Alpha codename is Aurora', at: jan, source_type: 'user_message' });
        await manager.ingestProjectEvent('beta', { kind: 'manual_fact', text: 'Beta codename is Borealis', at: jan, source_type: 'user_message' });
        const alpha = await manager.recallProject('alpha', { text: 'codename', now: apr }, 'project_strict');
        const beta = await manager.recallProject('beta', { text: 'codename', now: apr }, 'project_strict');
        expect(alpha.memories.map((item) => item.node.content.raw)).toEqual(['Alpha codename is Aurora']);
        expect(beta.memories.map((item) => item.node.content.raw)).toEqual(['Beta codename is Borealis']);
        await shared.close();
    });

    it('11. preserves commit, path, line, and checksum provenance on code facts', async () => {
        const manager = await createProjectMemory(config());
        await manager.ingestProjectEvent('alpha', { kind: 'code_fact', text: 'createProjectMemory is exported here', at: jan, source_type: 'github', external_id: 'file:src/index.ts', url: 'https://github.test/blob/abc/src/index.ts#L30-L35', repo: 'CaviraOSS/OpenMemory', branch: 'main', commit: 'abc', file_path: 'src/index.ts', line_start: 30, line_end: 35, checksum: 'sha-file' });
        const result = await manager.recallProject('alpha', { text: 'createProjectMemory exported', now: apr }, 'project_code');
        expect(result.code_facts[0]).toMatchObject({ repo: 'CaviraOSS/OpenMemory', branch: 'main', commit: 'abc', file_path: 'src/index.ts', line_start: 30, line_end: 35, checksum: 'sha-file' });
        expect(result.citations[0]).toMatchObject({ commit: 'abc', file_path: 'src/index.ts', line_start: 30, line_end: 35 });
        await manager.close();
    });

    it('12. downranks stale code facts when the linked repo ref changes', async () => {
        const manager = await createProjectMemory(config());
        const github = new mock_connector('github', 'GitHub mock', 'github');
        await manager.linkSourceToProject('alpha', { connector_id: 'github', connector: github, label: 'CaviraOSS/OpenMemory', current_ref: 'new-commit', config: { documents: [] } });
        await manager.ingestProjectEvent('alpha', { kind: 'code_fact', topic: 'old-file', text: 'Handler lives in src/old.ts', at: jan, source_type: 'github', repo: 'CaviraOSS/OpenMemory', commit: 'old-commit', file_path: 'src/old.ts' });
        await manager.ingestProjectEvent('alpha', { kind: 'code_fact', topic: 'new-file', text: 'Handler lives in src/new.ts', at: mar, source_type: 'github', repo: 'CaviraOSS/OpenMemory', commit: 'new-commit', file_path: 'src/new.ts' });
        const result = await manager.recallProject('alpha', { text: 'Handler lives', now: apr }, 'project_code');
        expect(result.code_facts[0]).toMatchObject({ file_path: 'src/new.ts', stale: false, freshness_score: 1 });
        expect(result.code_facts.find((item) => item.file_path === 'src/old.ts')).toMatchObject({ stale: true, freshness_score: 0.2 });
        await manager.close();
    });

    it('13. keeps project context within its token budget', async () => {
        const manager = await createProjectMemory(config());
        for (let index = 0; index < 20; index++) {
            await manager.ingestProjectEvent('alpha', { kind: 'manual_fact', topic: `fact-${index}`, text: `Project fact ${index}: ${'detail '.repeat(40)}`, at: jan + index, source_type: 'document', replace_current: false });
        }
        const packet = await manager.getProjectContext('alpha', 'project facts', 120);
        expect(packet.debug_trace.tokens_used).toBeLessThanOrEqual(120);
        expect(packet.debug_trace.within_budget).toBe(true);
        expect(packet.retrieved_memories.length).toBeLessThan(20);
        await manager.close();
    });

    it('14. returns source citations with project recall', async () => {
        const manager = await createProjectMemory(config());
        await manager.ingestProjectEvent('alpha', { kind: 'deployment', text: 'Production deploys to eu-west-1', at: jan, source_type: 'deployment_log', external_id: 'deploy-42', url: 'https://deploy.test/42', source_id: 'deployment-api' });
        const result = await manager.recallProject('alpha', { text: 'Production deploys', now: apr }, 'project_strict');
        expect(result.citations).toHaveLength(1);
        expect(result.citations[0]).toMatchObject({ source_type: 'deployment_log', external_id: 'deploy-42', url: 'https://deploy.test/42' });
        await manager.close();
    });

    it('exposes structured decision and task memory APIs', async () => {
        const manager = await createProjectMemory(config());
        await manager.ingestProjectEvent('alpha', { kind: 'decision', topic: 'api-framework', text: 'Use Fastify for the API', rationale: 'Lower overhead and schema support', alternatives_rejected: ['Express'], at: jan, source_type: 'architecture_note', url: 'file:///decisions/api.md' });
        await manager.ingestProjectEvent('alpha', { kind: 'task', topic: 'connector-tests', text: 'Add connector regression tests', status: 'blocked', priority: 'high', owner: 'Alice Chen', at: mar, source_type: 'issue', url: 'https://issues.test/42' });
        expect(await manager.getProjectDecisions('alpha')).toEqual([expect.objectContaining({ decision: 'Use Fastify for the API', rationale: 'Lower overhead and schema support', alternatives_rejected: ['Express'], current: true })]);
        expect(await manager.getProjectTasks('alpha')).toEqual([expect.objectContaining({ task: 'Add connector regression tests', status: 'blocked', priority: 'high', owner: 'Alice Chen', issue_url: 'https://issues.test/42' })]);
        await manager.close();
    });

    it('recovers project summaries and agent handoff after SQLite reopen', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'openmemory-project-'));
        dirs.push(dir);
        const db_path = join(dir, 'project.db');
        const first = await createProjectMemory({ ...config(), store: 'sqlite', db_path });
        await first.ingestProjectEvent('alpha', { kind: 'architecture', topic: 'database', text: 'Project database is SQLite', at: jan, source_type: 'architecture_note' });
        await first.ingestProjectEvent('alpha', { kind: 'agent_state', topic: 'Persist project memory', text: 'Agent is validating restart continuity', at: mar, subjective: true, next_actions: ['Reopen the project database'], metadata: { current_plan: ['Close', 'Reopen'], known_failures: ['State must not live only in chat'] } });
        const root_id = first.getProject('alpha').root_world_id;
        await first.close();

        const reopened = await createProjectMemory({ ...config(), store: 'sqlite', db_path });
        const packet = await reopened.getProjectContext('alpha', 'continue restart validation', 500);
        expect(reopened.getProject('alpha').root_world_id).toBe(root_id);
        expect(reopened.getProject('alpha').current_architecture_summary).toBe('Project database is SQLite');
        expect(packet.suggested_next_steps).toContain('Reopen the project database');
        expect(packet.known_failures).toContain('State must not live only in chat');
        await reopened.close();
    });

    it('versions, binds, matches, archives, and recovers project skills', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'openmemory-skills-'));
        dirs.push(dir);
        const db_path = join(dir, 'project.db');
        const first = await createProjectMemory({ ...config(), store: 'sqlite', db_path });
        const created = await first.createSkill('alpha', {
            name: 'Release check', description: 'Validate a release before publishing.',
            triggers: ['release checklist', 'publish package'],
            instructions: ['Run the full test suite', 'Build all packages', 'Inspect package contents'],
            validation: ['All tests pass', 'Package contains only intended files'],
            resources: [{ path: 'README.md', description: 'Release commands' }], visibility: 'project', owner: 'alice', at: jan,
        });
        const revised = await first.createSkill('alpha', {
            ...created, owner: created.owner ?? undefined, description: 'Validate and package a release before publishing.',
            instructions: [...created.instructions, 'Run a package smoke test'], at: mar,
        });
        const bound = await first.bindSkill('alpha', created.skill_id, ['reviewer'], mar + 1);
        expect(revised.version).toBe(2);
        expect(bound).toMatchObject({ version: 3, agent_ids: ['reviewer'] });
        expect(await first.getAsset('alpha', `asset:skill:${created.skill_id}`)).toMatchObject({ type: 'skill', status: 'approved', version: 3, bindings: [expect.objectContaining({ target_id: 'reviewer', injection_mode: 'direct' })] });
        expect(await first.matchSkills('alpha', 'prepare the release checklist', 'reviewer')).toEqual([
            expect.objectContaining({ skill: expect.objectContaining({ skill_id: created.skill_id, version: 3 }), matched_triggers: ['release checklist'] }),
        ]);
        expect(await first.matchSkills('alpha', 'prepare the release checklist', 'builder')).toEqual([]);
        await first.close();

        const reopened = await createProjectMemory({ ...config(), store: 'sqlite', db_path });
        expect(await reopened.getSkill('alpha', created.skill_id)).toMatchObject({ version: 3, agent_ids: ['reviewer'], status: 'active' });
        const archived = await reopened.archiveSkill('alpha', created.skill_id, apr);
        expect(archived).toMatchObject({ version: 4, status: 'archived', agent_ids: [] });
        expect(await reopened.listSkills('alpha')).toEqual([]);
        expect(await reopened.listSkills('alpha', true)).toEqual([expect.objectContaining({ skill_id: created.skill_id, status: 'archived' })]);
        await reopened.close();
    });

    it('searches code symbols and traces callers, callees, and impact paths', async () => {
        const manager = await createProjectMemory(config());
        await manager.ingestProjectEvent('alpha', {
            kind: 'code_fact', topic: 'src/release.ts', text: 'release implementation', at: jan, source_type: 'github', file_path: 'src/release.ts',
            metadata: { analysis: { role: 'source', language: 'TypeScript', symbols: [
                { name: 'publish', kind: 'function', line: 1, end_line: 3, signature: 'function publish()', exported: true, calls: ['validate'] },
                { name: 'validate', kind: 'function', line: 4, end_line: 6, signature: 'function validate()', exported: false, calls: ['checkTests'] },
                { name: 'checkTests', kind: 'function', line: 7, end_line: 8, signature: 'function checkTests()', exported: false, calls: [] },
            ] } },
        });
        expect(await manager.searchCodeSymbols('alpha', 'valid')).toEqual([expect.objectContaining({ name: 'validate', file_path: 'src/release.ts' })]);
        expect(await manager.getCodeCallers('alpha', 'validate')).toEqual([expect.objectContaining({ caller: expect.objectContaining({ name: 'publish' }) })]);
        expect(await manager.getCodeCallees('alpha', 'validate')).toEqual([expect.objectContaining({ callee: expect.objectContaining({ name: 'checkTests' }) })]);
        expect(await manager.getCodeImpact('alpha', 'checkTests')).toEqual([
            expect.objectContaining({ symbol: expect.objectContaining({ name: 'checkTests' }), depth: 0 }),
            expect.objectContaining({ symbol: expect.objectContaining({ name: 'validate' }), depth: 1, via: 'checkTests' }),
            expect.objectContaining({ symbol: expect.objectContaining({ name: 'publish' }), depth: 2, via: 'validate' }),
        ]);
        await manager.close();
    });

    it('imports past agent sessions with exact order, timestamps, and restart recovery', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'openmemory-sessions-'));
        dirs.push(dir);
        const db_path = join(dir, 'project.db');
        const first = await createProjectMemory({ ...config(), store: 'sqlite', db_path });
        const imported = await first.importSession('alpha', {
            session_id: 'codex-42', agent_id: 'builder', provider: 'codex', started_at: jan, source_ref: 'history/codex-42.json',
            messages: [
                { role: 'user', content: 'Implement project Skills.', at: jan },
                { role: 'assistant', content: 'I added immutable Skill versions.', at: jan + 10 },
                { role: 'tool', name: 'vitest', tool_call_id: 'call-1', content: '17 tests passed.', at: jan + 20 },
            ],
        });
        expect(imported).toMatchObject({ message_count: 3, started_at: jan, ended_at: jan + 20, provider: 'codex' });
        expect(await first.getAsset('alpha', 'asset:chat_memory:codex-42')).toMatchObject({ type: 'chat_memory', status: 'candidate', visibility: 'agent' });
        const turn = await first.explainProjectMemory('alpha', imported.node_ids[2]);
        expect(turn.node).toMatchObject({ content: { raw: '17 tests passed.' }, metadata: { session_role: 'tool', session_sequence: 2, tool_call_id: 'call-1' } });
        await first.close();

        const reopened = await createProjectMemory({ ...config(), store: 'sqlite', db_path });
        expect(await reopened.listSessions('alpha')).toEqual([expect.objectContaining({ session_id: 'codex-42', message_count: 3, node_ids: expect.arrayContaining(imported.node_ids) })]);
        await expect(reopened.importSession('alpha', {
            session_id: 'codex-42', agent_id: 'builder', provider: 'codex', messages: [{ role: 'user', content: 'duplicate' }],
        })).rejects.toThrow('already imported');
        await expect(reopened.importSession('alpha', { session_id: 'bad', agent_id: 'builder', provider: 'codex', messages: [
            { role: 'user', content: 'later', at: mar }, { role: 'assistant', content: 'earlier', at: jan },
        ] })).rejects.toThrow('timestamps must be monotonic');
        await reopened.close();
    });

    it('governs four asset types with lifecycle, deny-first ACLs, bindings, and loadout budgets', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'openmemory-assets-'));
        dirs.push(dir);
        const db_path = join(dir, 'project.db');
        const first = await createProjectMemory({ ...config(), store: 'sqlite', db_path });
        const base = {
            owner_id: 'alice', source_type: 'test', visibility: 'project' as const, status: 'approved' as const,
            bindings: [{ target_type: 'agent' as const, target_id: 'builder', injection_mode: 'reference' as const, priority: 0.8, required: false, enabled: true, created_by: 'alice' }],
        };
        const chat = await first.registerAsset('alpha', { ...base, type: 'chat_memory', name: 'Prior sessions', description: 'Prior implementation context', content_ref: 'openmemory://project/alpha/sessions' });
        const skill = await first.registerAsset('alpha', { ...base, type: 'skill', name: 'Release check', description: 'Run the release checklist', content_ref: 'openmemory://project/alpha/skills/release', payload: { instructions: ['Run tests'] } });
        await first.registerAsset('alpha', { ...base, type: 'llm_wiki', name: 'Architecture wiki', description: 'Project architecture', content_ref: 'openmemory://project/alpha/wiki', status: 'candidate' });
        const graph = await first.registerAsset('alpha', {
            ...base, type: 'code_graph', name: 'Code graph', description: 'Symbols and impact paths', content_ref: 'openmemory://project/alpha/code-graph',
            acl: [{ subject_type: 'agent', subject_id: 'builder', permissions: ['use'], effect: 'deny' }],
        });
        const loadout = await first.resolveAssetLoadout('alpha', { query: 'release architecture', user_id: 'bob', agent_id: 'builder', framework: 'codex', token_budget: 512 });
        expect(loadout.selected.map((item) => item.asset.asset_id)).toEqual([skill.asset_id, chat.asset_id]);
        expect(loadout.excluded).toEqual(expect.arrayContaining([
            { asset_id: graph.asset_id, reason: 'denied by agent:builder' },
            expect.objectContaining({ reason: 'asset status is candidate' }),
        ]));
        expect(loadout.selected.every((item) => item.annotations.audience[0] === 'assistant')).toBe(true);
        expect(loadout.within_budget).toBe(true);
        expect(await first.decideAssetAccess('alpha', skill.asset_id, { user_id: 'bob', agent_id: 'builder' }, 'manage')).toMatchObject({ allowed: false, reason: 'manage requires owner or explicit ACL' });
        await expect(first.registerAsset('alpha', { ...base, type: 'unknown' as 'skill', name: 'Bad', description: 'Bad type', content_ref: 'bad' })).rejects.toThrow('asset type must be one of');
        await expect(first.governAsset('alpha', skill.asset_id, { status: 'draft' })).rejects.toThrow('approved -> draft');
        await first.close();

        const reopened = await createProjectMemory({ ...config(), store: 'sqlite', db_path });
        expect((await reopened.getProject('alpha')).world_ids.assets).toBeTruthy();
        expect(await reopened.listAssets('alpha')).toHaveLength(4);
        expect(await reopened.getAsset('alpha', skill.asset_id)).toMatchObject({ version: 1, status: 'approved', type: 'skill' });
        const manifest = await reopened.buildAgentManifest('alpha', {
            agent_id: 'builder', framework: 'codex', query: 'release architecture', user_id: 'bob', token_budget: 512,
            interface_url: 'https://agents.example.test/a2a',
        });
        await reopened.close();
        expect(manifest).toMatchObject({
            schema: 'https://openmemory.dev/schemas/agent-memory-manifest/v1',
            agent: { id: 'builder', framework: 'codex' }, capabilities: { mcp: true, a2a_agent_card: true },
            a2a_extension: { uri: 'https://openmemory.dev/extensions/memory-assets/v1' },
            agent_card: { supportedInterfaces: [{ protocolBinding: 'HTTP+JSON', protocolVersion: '1.0' }] },
        });
        expect(manifest.agent_card?.skills.map((value) => value.id)).toContain(skill.asset_id);
    });
});