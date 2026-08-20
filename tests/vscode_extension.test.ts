import { describe, expect, it } from 'vitest';
import { context_markdown, recall_markdown } from '../apps/vscode-extension/src/markdown.js';
import { merge_file_change, render_agent_change, render_file_patch, should_capture_path } from '../apps/vscode-extension/src/agent_changes.js';
import { build_status_bar_model } from '../apps/vscode-extension/src/status_bar_model.js';

describe('VS Code extension rendering', () => {
    it('builds stable manager and AI activity status states', () => {
        const ready = build_status_bar_model({
            ok: true, project: { id: 'openmemory', name: 'OpenMemory', initialized: true }, db_path: '.openmemory/project.db',
            memory: { nodes: 12, active: 9, grounded: 4, superseded: 3, worlds: 18 }, recent_memories: [], unresolved_conflicts: 1,
        }, { active: null, pending: 2 });
        expect(ready).toMatchObject({ memory_text: '$(database) Memory 9', memory_severity: 'warning', activity: { text: '$(diff) 2', review: true } });
        expect(build_status_bar_model(null, { active: 'codex', pending: 0 }, 'OpenMemory is not initialized.')).toMatchObject({ memory_text: '$(database) Memory', memory_severity: 'normal', activity: { text: '$(record) codex', review: false } });
        expect(build_status_bar_model(null, { active: null, pending: 0 }, 'Unable to start OpenMemory CLI')).toMatchObject({ memory_text: '$(warning) Memory', memory_severity: 'error', activity: null });
    });

    it('renders recall hits with score, provenance, and memory id', () => {
        const value = recall_markdown({
            ok: true,
            mode: 'associative',
            query: 'rollback procedure',
            hits: [{ id: 'node:1', text: 'Use the blue deployment.', status: 'active', score: 0.875, grounded: true, citation: 'docs/runbook.md' }],
        });
        expect(value).toContain('rollback procedure');
        expect(value).toContain('0.875');
        expect(value).toContain('docs/runbook.md');
        expect(value).toContain('node:1');
    });

    it('renders a project brief with constraints, files, and next steps', () => {
        const value = context_markdown({
            ok: true,
            project_id: 'openmemory',
            task: 'ship extension',
            project_summary: 'Hydrograph memory.',
            current_goal: 'Release the extension.',
            hard_constraints: ['Recall stays read-only.'],
            relevant_architecture: ['CLI owns native transport.'],
            relevant_files: [{ path: 'src/cli/cli_app.ts' }],
            active_decisions: [{ decision: 'Use CLI JSON.', current: true }],
            open_tasks: [{ task: 'Package VSIX', status: 'open' }],
            known_failures: [],
            matched_skills: [{ score: 2, matched_triggers: ['release'], skill: { skill_id: 'skill:release', name: 'Release check', description: 'Validate the release.', version: 2, instructions: ['Run tests'], validation: ['Tests pass'] } }],
            asset_loadout: { selected: [{ asset: { asset_id: 'asset:wiki', type: 'llm_wiki', name: 'Architecture wiki', version: 1, content_ref: 'openmemory://wiki' }, binding: { injection_mode: 'tool', priority: 0.8 }, annotations: { audience: ['assistant'], priority: 0.8, last_modified: new Date(0).toISOString() } }], excluded: [], tokens_used: 20, token_budget: 512 },
            conflicts: [],
            suggested_next_steps: ['Run extension checks.'],
        });
        expect(value).toContain('Recall stays read-only.');
        expect(value).toContain('src/cli/cli_app.ts');
        expect(value).toContain('Run extension checks.');
        expect(value).toContain('Release check v2');
        expect(value).toContain('Run tests');
        expect(value).toContain('Equipped Memory Assets');
        expect(value).toContain('Architecture wiki');
    });

    it('renders compact line patches and redacts credential-like lines', () => {
        const patch = render_file_patch({
            path: 'src/config.ts', language: 'typescript', changed_at: 1,
            before: 'const port = 7000;\nconst token = "old";\n',
            after: 'const port = 7331;\nconst token = "secret";\n',
        });
        expect(patch).toContain('-const port = 7000;');
        expect(patch).toContain('+const port = 7331;');
        expect(patch).not.toContain('secret');
        expect(patch).toContain('[redacted credential-like line]');
    });

    it('coalesces repeated saves from the first baseline to the latest content', () => {
        const first = { path: 'src/a.ts', language: 'typescript', changed_at: 1, before: 'a', after: 'b' };
        const second = { path: 'src/a.ts', language: 'typescript', changed_at: 2, before: 'b', after: 'c' };
        expect(merge_file_change(merge_file_change([], first), second)).toEqual([{ ...second, before: 'a' }]);
    });

    it('keeps distant edits in compact independent hunks', () => {
        const before = Array.from({ length: 100 }, (_, index) => `line ${index}`);
        const after = [...before];
        after[1] = 'changed near start';
        after[98] = 'changed near end';
        const patch = render_file_patch({ path: 'src/large.ts', language: 'typescript', changed_at: 1, before: before.join('\n'), after: after.join('\n') });
        expect(patch.match(/^@@/gm)).toHaveLength(2);
        expect(patch).toContain('+changed near start');
        expect(patch).toContain('+changed near end');
        expect(patch).not.toContain('line 50');
    });

    it('filters sensitive and binary paths and caps stored patches', () => {
        expect(should_capture_path('.env')).toBe(false);
        expect(should_capture_path('certs/private.pem')).toBe(false);
        expect(should_capture_path('node_modules/pkg/index.js')).toBe(false);
        expect(should_capture_path('src/app.ts')).toBe(true);
        const rendered = render_agent_change({
            id: 'change', agent: 'copilot', confidence: 'explicit', started_at: 1, updated_at: 2,
            files: [
                { path: 'src/reverted.ts', language: 'typescript', changed_at: 2, before: 'same', after: 'same' },
                { path: 'src/app.ts', language: 'typescript', changed_at: 2, before: 'a', after: `a\n${'x'.repeat(1_000)}` },
            ],
        }, 200);
        expect(rendered?.metadata.truncated).toBe(true);
        expect(rendered?.metadata.files).toEqual(['src/app.ts']);
        expect(rendered?.metadata.change_count).toBe(1);
        expect(Buffer.byteLength(rendered?.text ?? '')).toBeLessThanOrEqual(200);
    });

    it('redacts authorization values and honors tiny direct byte budgets', () => {
        const rendered = render_agent_change({
            id: 'tiny', agent: 'codex', confidence: 'explicit', started_at: 1, updated_at: 2,
            files: [{ path: 'src/api.ts', language: 'typescript', changed_at: 2, before: '', after: 'Authorization: Bearer actual-secret' }],
        }, 24);
        expect(rendered?.text).not.toContain('actual-secret');
        expect(Buffer.byteLength(rendered?.text ?? '')).toBeLessThanOrEqual(24);
    });
});