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
 *  file  : apps/vscode-extension/src/agent_tracker.ts
 *  usage : supports the LongMemory VS Code extension agent tracker
 */

import * as vscode from 'vscode';
import {
    change_id,
    merge_file_change,
    render_agent_change,
    should_capture_path,
    type agent_kind,
    type pending_agent_change,
    type pending_file_change,
} from './agent_changes.js';
import { longmemory_cli } from './cli.js';

export type agent_tracker_status = { active: agent_kind | null; pending: number };

type queued_change = pending_agent_change & { resource: vscode.Uri };

type active_session = queued_change & {
    explicit: true;
    baselines: Map<string, string>;
    dirty: Map<string, vscode.Uri>;
    created: Set<string>;
    deleted: Set<string>;
    watcher: vscode.FileSystemWatcher;
};

const known_extensions: Array<{ ids: string[]; agent: agent_kind }> = [
    { ids: ['github.copilot', 'github.copilot-chat'], agent: 'copilot' },
    { ids: ['openai.chatgpt', 'openai.codex'], agent: 'codex' },
    { ids: ['anthropic.claude-code', 'anthropic.claude'], agent: 'claude' },
    { ids: ['codeium.windsurf', 'codeium.codeium'], agent: 'windsurf' },
];

const installed_agents = (): agent_kind[] => [...new Set(known_extensions
    .filter((candidate) => candidate.ids.some((id) => vscode.extensions.getExtension(id)))
    .map((candidate) => candidate.agent))];

const relative_path = (resource: vscode.Uri): string => vscode.workspace.asRelativePath(resource, false).replaceAll('\\', '/');
const snapshot_exclude = '{**/.git/**,**/.longmemory/**,**/node_modules/**,**/dist/**,**/out/**,**/build/**,**/coverage/**}';

export class agent_change_tracker implements vscode.Disposable {
    private readonly baselines = new Map<string, string>();
    private readonly heuristic = new Map<string, queued_change>();
    private readonly timers = new Map<string, NodeJS.Timeout>();
    private readonly queue: queued_change[] = [];
    private readonly subscriptions: vscode.Disposable[] = [];
    private active: active_session | null = null;

    constructor(
        private readonly cli: longmemory_cli,
        private readonly output: vscode.OutputChannel,
        private readonly on_status: (status: agent_tracker_status) => void,
        private readonly after_record: () => Promise<void>,
    ) {
        for (const document of vscode.workspace.textDocuments) this.remember_baseline(document);
        this.subscriptions.push(
            vscode.workspace.onDidOpenTextDocument((document) => this.remember_baseline(document)),
            vscode.workspace.onDidCloseTextDocument((document) => this.baselines.delete(document.uri.toString())),
            vscode.workspace.onDidChangeTextDocument((event) => this.changed(event)),
            vscode.workspace.onDidSaveTextDocument((document) => this.saved(document)),
        );
    }

    status(): agent_tracker_status { return { active: this.active?.agent ?? null, pending: this.queue.length + this.heuristic.size }; }

    async start(preset_agent?: agent_kind, preset_label?: string): Promise<void> {
        if (this.active) {
            const replace = await vscode.window.showWarningMessage(`A ${this.active.agent} session is already active. Stop it first?`, { modal: true }, 'Stop Session');
            if (!replace) return;
            await this.stop();
        }
        const detected = installed_agents();
        const items = [
            { label: 'GitHub Copilot', agent: 'copilot' as const },
            { label: 'OpenAI Codex', agent: 'codex' as const },
            { label: 'Claude', agent: 'claude' as const },
            { label: 'Cursor', agent: 'cursor' as const },
            { label: 'Windsurf / Codeium', agent: 'windsurf' as const },
            { label: 'Other AI agent', agent: 'other' as const },
        ].map((item) => ({ ...item, description: detected.includes(item.agent) ? 'installed' : undefined }));
        const selected = preset_agent
            ? items.find((item) => item.agent === preset_agent) ?? { label: preset_label ?? preset_agent, agent: preset_agent }
            : await vscode.window.showQuickPick(items, { title: 'Start AI change session', placeHolder: 'Which agent will edit this workspace?' });
        if (!selected) return;
        const resource = this.cli.current_resource();
        if (!resource) { vscode.window.showWarningMessage('Open a workspace before starting an AI change session.'); return; }
        const at = Date.now();
        const baselines = await this.snapshot_workspace(resource);
        const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(resource, '**/*'));
        const session: active_session = {
            id: change_id(selected.agent, at), agent: selected.agent, confidence: 'explicit', started_at: at, updated_at: at,
            files: [], resource, explicit: true, baselines, dirty: new Map(), created: new Set(), deleted: new Set(), watcher,
        };
        this.active = session;
        watcher.onDidCreate((uri) => this.track_disk_change(session, uri, 'create'));
        watcher.onDidChange((uri) => this.track_disk_change(session, uri, 'change'));
        watcher.onDidDelete((uri) => this.track_disk_change(session, uri, 'delete'));
        this.on_status(this.status());
        vscode.window.showInformationMessage(`Recording ${selected.label} changes. Use “Stop AI Change Session” when the agent is done.`);
    }

    async stop(): Promise<void> {
        const session = this.active;
        if (!session) { vscode.window.showInformationMessage('No explicit AI change session is active.'); return; }
        session.watcher.dispose();
        await this.materialize_session(session);
        this.active = null;
        this.on_status(this.status());
        if (!session.files.length) { vscode.window.showInformationMessage(`No file changes were captured for ${session.agent}.`); return; }
        if (this.setting<boolean>('autoRecordExplicit', session.resource, true)) {
            try { await this.record(session); }
            catch (error) {
                this.queue.push(session);
                this.on_status(this.status());
                throw error;
            }
        }
        else { this.queue.push(session); this.on_status(this.status()); await this.review(); }
    }

    async review(): Promise<void> {
        this.finalize_heuristics();
        if (!this.queue.length) { vscode.window.showInformationMessage('No AI change candidates are waiting for review.'); return; }
        const selected = await vscode.window.showQuickPick(this.queue.map((change) => ({
            label: `${change.agent} · ${change.files.length} file${change.files.length === 1 ? '' : 's'}`,
            description: change.confidence,
            detail: change.files.map((file) => file.path).join(', '),
            change,
        })), { title: 'Review AI change candidates', placeHolder: 'Select a change set to inspect' });
        if (!selected) return;
        const rendered = render_agent_change(selected.change, this.max_patch_bytes(selected.change.resource));
        if (!rendered) { this.remove(selected.change.id); return; }
        const document = await vscode.workspace.openTextDocument({ language: 'diff', content: rendered.text });
        await vscode.window.showTextDocument(document, { preview: true });
        const action = await vscode.window.showInformationMessage(
            `${selected.change.agent} attribution is ${selected.change.confidence}. Record this reviewed patch?`,
            { modal: true },
            'Record', 'Discard',
        );
        if (action === 'Record') await this.record(selected.change);
        else if (action === 'Discard') { this.remove(selected.change.id); this.on_status(this.status()); }
    }

    discard_all(): void {
        this.queue.splice(0);
        this.heuristic.clear();
        for (const timer of this.timers.values()) clearTimeout(timer);
        this.timers.clear();
        this.on_status(this.status());
    }

    dispose(): void {
        this.active?.watcher.dispose();
        for (const subscription of this.subscriptions) subscription.dispose();
        for (const timer of this.timers.values()) clearTimeout(timer);
        this.timers.clear();
    }

    private changed(event: vscode.TextDocumentChangeEvent): void {
        const document = event.document;
        if (document.uri.scheme !== 'file' || !event.contentChanges.length) return;
        const key = document.uri.toString();
        const before = this.baselines.get(key);
        const after = document.getText();
        this.baselines.set(key, after);
        if (before === undefined || before === after) return;
        const path = relative_path(document.uri);
        if (!should_capture_path(path)) return;
        const max_document_bytes = this.setting<number>('maxDocumentBytes', document.uri, 1_000_000);
        if (Buffer.byteLength(before) > max_document_bytes || Buffer.byteLength(after) > max_document_bytes) return;
        const resource = vscode.workspace.getWorkspaceFolder(document.uri)?.uri;
        if (!resource) return;
        if (this.active && this.active.resource.toString() === resource.toString()) {
            if (!this.active.baselines.has(path)) this.active.baselines.set(path, before);
            this.active.dirty.set(path, document.uri);
            this.active.deleted.delete(path);
            this.active.updated_at = Date.now();
            this.on_status(this.status());
            return;
        }
        const next: pending_file_change = { path, language: document.languageId, before, after, changed_at: Date.now() };
        if (!this.setting<boolean>('heuristicDetection', resource, false)) return;
        const detected = installed_agents();
        if (!detected.length) return;
        const root = resource.toString();
        const current = this.heuristic.get(root);
        const agent = detected.length === 1 ? detected[0] as agent_kind : 'other';
        const value: queued_change = current ?? { id: change_id(agent, next.changed_at), agent, confidence: 'heuristic', started_at: next.changed_at, updated_at: next.changed_at, files: [], resource };
        value.files = merge_file_change(value.files, next);
        value.updated_at = next.changed_at;
        this.heuristic.set(root, value);
        this.schedule(root, resource);
        this.on_status(this.status());
    }

    private saved(document: vscode.TextDocument): void {
        const resource = vscode.workspace.getWorkspaceFolder(document.uri)?.uri;
        if (resource) this.schedule(resource.toString(), resource, 500);
    }

    private schedule(root: string, resource: vscode.Uri, delay?: number): void {
        const prior = this.timers.get(root);
        if (prior) clearTimeout(prior);
        const quiet_ms = delay ?? this.setting<number>('quietPeriodMs', resource, 3_000);
        this.timers.set(root, setTimeout(() => {
            this.timers.delete(root);
            const change = this.heuristic.get(root);
            if (!change) return;
            this.heuristic.delete(root);
            this.queue.push(change);
            this.on_status(this.status());
        }, quiet_ms));
    }

    private finalize_heuristics(): void {
        for (const [root, change] of this.heuristic) {
            this.queue.push(change);
            this.heuristic.delete(root);
            const timer = this.timers.get(root);
            if (timer) clearTimeout(timer);
            this.timers.delete(root);
        }
        this.on_status(this.status());
    }

    private async record(change: queued_change): Promise<void> {
        const rendered = render_agent_change(change, this.max_patch_bytes(change.resource));
        if (!rendered) { this.remove(change.id); return; }
        await this.cli.run<{ memory_id: string }>([
            'ingest', '--stdin', '--source', `vscode-agent:${change.agent}`, '--type', 'agent_change', '--metadata-json', JSON.stringify(rendered.metadata),
        ], { input: rendered.text, resource: change.resource, timeout_ms: 120_000 });
        this.remove(change.id);
        this.on_status(this.status());
        await this.after_record();
        vscode.window.showInformationMessage(`Recorded ${change.agent} change set across ${rendered.metadata.change_count} file${rendered.metadata.change_count === 1 ? '' : 's'}.`);
    }

    private remove(id: string): void {
        const index = this.queue.findIndex((change) => change.id === id);
        if (index >= 0) this.queue.splice(index, 1);
    }

    private remember_baseline(document: vscode.TextDocument): void {
        if (document.uri.scheme === 'file') this.baselines.set(document.uri.toString(), document.getText());
    }

    private setting<T>(name: string, resource: vscode.Uri, fallback: T): T {
        return vscode.workspace.getConfiguration('longmemory.agentChanges', resource).get<T>(name, fallback);
    }

    private max_patch_bytes(resource: vscode.Uri): number {
        return this.setting<number>('maxPatchBytes', resource, 65_536);
    }

    private async snapshot_workspace(resource: vscode.Uri): Promise<Map<string, string>> {
        const values = new Map<string, string>();
        const max_document_bytes = this.setting<number>('maxDocumentBytes', resource, 1_000_000);
        const max_snapshot_bytes = this.setting<number>('maxSessionSnapshotBytes', resource, 33_554_432);
        const uris = await vscode.workspace.findFiles(new vscode.RelativePattern(resource, '**/*'), snapshot_exclude, 10_000);
        let used = 0;
        let skipped = 0;
        for (const uri of uris) {
            const path = relative_path(uri);
            if (!should_capture_path(path)) continue;
            const text = await this.read_text(uri, max_document_bytes);
            if (text === null) { skipped++; continue; }
            const bytes = Buffer.byteLength(text);
            if (used + bytes > max_snapshot_bytes) { skipped++; continue; }
            values.set(path, text);
            used += bytes;
        }
        this.output.appendLine(`AI change session baseline: ${values.size} files, ${used} bytes${skipped ? `, ${skipped} skipped by privacy or size limits` : ''}.`);
        return values;
    }

    private track_disk_change(session: active_session, uri: vscode.Uri, kind: 'create' | 'change' | 'delete'): void {
        if (this.active !== session) return;
        const path = relative_path(uri);
        if (!should_capture_path(path)) return;
        session.dirty.set(path, uri);
        if (kind === 'create') { session.created.add(path); session.deleted.delete(path); }
        else if (kind === 'delete') session.deleted.add(path);
        session.updated_at = Date.now();
        this.on_status(this.status());
    }

    private async materialize_session(session: active_session): Promise<void> {
        const max_document_bytes = this.setting<number>('maxDocumentBytes', session.resource, 1_000_000);
        let skipped = 0;
        for (const [path, uri] of session.dirty) {
            const before = session.baselines.get(path) ?? (session.created.has(path) ? '' : null);
            if (before === null) { skipped++; continue; }
            const after = session.deleted.has(path) ? '' : await this.read_text(uri, max_document_bytes);
            if (after === null) { skipped++; continue; }
            const document = vscode.workspace.textDocuments.find((value) => value.uri.toString() === uri.toString());
            session.files = merge_file_change(session.files, {
                path, language: document?.languageId ?? 'plaintext', before, after, changed_at: session.updated_at,
            });
        }
        if (skipped) this.output.appendLine(`AI change session skipped ${skipped} changed file(s) without a safe baseline or within size limits.`);
    }

    private async read_text(uri: vscode.Uri, max_bytes: number): Promise<string | null> {
        const document = vscode.workspace.textDocuments.find((value) => value.uri.toString() === uri.toString());
        if (document) {
            const text = document.getText();
            return Buffer.byteLength(text) <= max_bytes ? text : null;
        }
        try {
            const stat = await vscode.workspace.fs.stat(uri);
            if (!(stat.type & vscode.FileType.File) || stat.size > max_bytes) return null;
            const bytes = await vscode.workspace.fs.readFile(uri);
            const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
            return text.includes('\0') ? null : text;
        } catch { return null; }
    }
}
