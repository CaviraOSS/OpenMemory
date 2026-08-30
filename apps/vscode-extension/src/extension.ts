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
 *  file  : apps/vscode-extension/src/extension.ts
 *  usage : supports the LongMemory VS Code extension extension
 */

import * as vscode from 'vscode';
import { cli_error, longmemory_cli } from './cli.js';
import { context_markdown, recall_markdown } from './markdown.js';
import { memory_item, memory_tree } from './memory_tree.js';
import { agent_change_tracker, type agent_tracker_status } from './agent_tracker.js';
import { memory_status_bar } from './status_bar.js';
import type { harness_detection_result, project_context_result, recall_result, session_discovery_result, session_port_result, status_result, harness_id } from './types.js';

const show_document = async (title: string, content: string) => {
    const document = await vscode.workspace.openTextDocument({ language: 'markdown', content });
    await vscode.window.showTextDocument(document, { preview: true });
    return title;
};

const message = (error: unknown): string => error instanceof Error ? error.message : String(error);

type ai_agent = 'copilot' | 'codex' | 'claude' | 'cursor' | 'windsurf';
const ai_extensions: Array<{ ids: string[]; agent: ai_agent; label: string }> = [
    { ids: ['github.copilot-chat', 'github.copilot'], agent: 'copilot', label: 'GitHub Copilot' },
    { ids: ['openai.chatgpt', 'openai.codex'], agent: 'codex', label: 'OpenAI Codex' },
    { ids: ['anthropic.claude-code', 'anthropic.claude'], agent: 'claude', label: 'Claude Code' },
    { ids: ['saoudrizwan.claude-dev', 'cline.cline'], agent: 'claude', label: 'Cline' },
    { ids: ['codeium.windsurf', 'codeium.codeium'], agent: 'windsurf', label: 'Windsurf / Codeium' },
];
const installed_ai_agents = (): Array<{ agent: ai_agent; label: string }> => [...new Map(ai_extensions
    .filter((candidate) => candidate.ids.some((id) => vscode.extensions.getExtension(id)))
    .map((candidate) => [candidate.label, { agent: candidate.agent, label: candidate.label }])).values()];

const harness_labels: Record<harness_id, string> = {
    'claude-code': 'Claude Code', codex: 'Codex', opencode: 'OpenCode', 'gemini-cli': 'Gemini CLI',
    'copilot-chat': 'VS Code Copilot Chat', cline: 'Cline', 'deepseek-harness': 'DeepSeek Harness',
};

export function activate(context: vscode.ExtensionContext): void {
    const output = vscode.window.createOutputChannel('LongMemory', { log: true });
    const cli = new longmemory_cli(output);
    const status = new memory_status_bar();

    let memory_status: status_result | null = null;
    let tracker_status: agent_tracker_status = { active: null, pending: 0 };
    let status_error: string | undefined;
    const render_status = () => {
        status.update(memory_status, tracker_status, status_error);
    };

    const update_status = (value: status_result | null, error?: string) => {
        memory_status = value;
        status_error = error;
        render_status();
    };
    const provider = new memory_tree(cli, update_status);
    const view = vscode.window.createTreeView('longmemory.memories', { treeDataProvider: provider, showCollapseAll: false });

    const run = async <T>(title: string, operation: () => Promise<T>): Promise<T | undefined> => {
        try {
            return await vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title, cancellable: false }, operation);
        } catch (error) {
            output.appendLine(error instanceof cli_error ? error.detail : message(error));
            const action = await vscode.window.showErrorMessage(message(error), 'Open Output');
            if (action) output.show(true);
            return undefined;
        }
    };
    const refresh = async () => {
        await provider.refresh();
        view.message = provider.empty_message;
    };
    const refresh_after_write = async () => {
        const resource = cli.current_resource();
        if (vscode.workspace.getConfiguration('longmemory', resource).get<boolean>('autoRefresh', true)) await refresh();
    };
    const tracker = new agent_change_tracker(cli, output, (value) => { tracker_status = value; render_status(); }, refresh_after_write);

    const offer_ai_agent_attach = async (resource: vscode.Uri | undefined) => {
        const detected = installed_ai_agents();
        if (!detected.length) return;
        const selected = await vscode.window.showInformationMessage(
            `AI coding agent${detected.length === 1 ? '' : 's'} detected: ${detected.map((item) => item.label).join(', ')}. Attach LongMemory so agent edits are recorded as project memory?`,
            'Record Agent Changes', 'Not Now',
        );
        if (selected !== 'Record Agent Changes') return;
        if (detected.length === 1) {
            const only = detected[0];
            if (only) await tracker.start(only.agent, only.label);
            return;
        }
        const picked = await vscode.window.showQuickPick(detected.map((item) => ({ label: item.label, agent: item.agent })), { title: 'Record changes from which AI agent?' });
        if (picked) await tracker.start(picked.agent, picked.label);
        void resource;
    };

    context.subscriptions.push(
        output,
        cli,
        status,
        view,
        tracker,
        vscode.commands.registerCommand('longmemory.refresh', () => run('Refreshing LongMemory', refresh)),
        vscode.commands.registerCommand('longmemory.initialize', async () => {
            const resource = cli.current_resource();
            const result = await run('Initializing LongMemory', () => cli.run<{ ok: boolean; db_path: string }>(['init'], { resource }));
            if (!result) return;
            vscode.window.showInformationMessage(`LongMemory initialized: ${result.db_path}`);
            await refresh();
            await offer_ai_agent_attach(resource);
        }),
        vscode.commands.registerCommand('longmemory.rememberSelection', async () => {
            const editor = vscode.window.activeTextEditor;
            const text = editor?.document.getText(editor.selection);
            if (!editor || !text) { vscode.window.showWarningMessage('Select text to remember.'); return; }
            const source = vscode.workspace.asRelativePath(editor.document.uri, false);
            const result = await run('Remembering selection', () => cli.run<{ memory_id: string }>(['ingest', '--stdin', '--source', `vscode:${source}`, '--type', 'code_context'], { input: text, resource: editor.document.uri }));
            if (result) { vscode.window.showInformationMessage(`Remembered selection from ${source}`); await refresh_after_write(); }
        }),
        vscode.commands.registerCommand('longmemory.quickNote', async () => {
            const text = await vscode.window.showInputBox({ title: 'Remember a quick note', prompt: 'What should LongMemory remember?', ignoreFocusOut: true });
            if (!text?.trim()) return;
            const result = await run('Remembering note', () => cli.run<{ memory_id: string }>(['ingest', '--stdin', '--source', 'vscode-note', '--type', 'manual_note'], { input: text.trim(), resource: cli.current_resource() }));
            if (result) { vscode.window.showInformationMessage('Note remembered.'); await refresh_after_write(); }
        }),
        vscode.commands.registerCommand('longmemory.recall', async () => {
            const selected = vscode.window.activeTextEditor?.document.getText(vscode.window.activeTextEditor.selection).trim();
            const query = selected || await vscode.window.showInputBox({ title: 'Recall LongMemory context', prompt: 'What context do you need?', ignoreFocusOut: true });
            if (!query?.trim()) return;
            const resource = vscode.window.activeTextEditor?.document.uri ?? cli.current_resource();
            const mode = vscode.workspace.getConfiguration('longmemory', resource).get<string>('recallMode', 'associative');
            const result = await run('Recalling context', () => cli.run<recall_result>(['recall', query.trim(), '--mode', mode], { resource }));
            if (result) await show_document('LongMemory Recall', recall_markdown(result));
        }),
        vscode.commands.registerCommand('longmemory.projectContext', async () => {
            const task = await vscode.window.showInputBox({ title: 'Build project context', prompt: 'What task are you working on?', ignoreFocusOut: true });
            if (!task?.trim()) return;
            const resource = cli.current_resource();
            const config = vscode.workspace.getConfiguration('longmemory', resource);
            const agent_id = config.get<string>('agentId', '').trim();
            const framework = config.get<string>('framework', 'vscode').trim();
            const result = await run('Building project context', () => cli.run<project_context_result>([
                'project', 'context', task.trim(), ...(agent_id ? ['--agent', agent_id] : []), ...(framework ? ['--framework', framework] : []),
            ], { timeout_ms: 120_000, resource }));
            if (result) {
                const markdown = context_markdown(result);
                await show_document('LongMemory Project Context', markdown);
                await vscode.env.clipboard.writeText(markdown);
                vscode.window.showInformationMessage('Project context copied to clipboard.');
            }
        }),
        vscode.commands.registerCommand('longmemory.explain', async (item?: memory_item) => {
            const id = item?.memory.id ?? await vscode.window.showInputBox({ title: 'Explain memory', prompt: 'Memory ID' });
            if (!id) return;
            const result = await run('Explaining memory', () => cli.run<{ node: { id: string; content: { raw: string }; state: Record<string, unknown>; metadata: Record<string, unknown> }; incoming_edges: unknown[]; outgoing_edges: unknown[] }>(['explain', id], { resource: item?.resource ?? cli.current_resource() }));
            if (result) await show_document('LongMemory Explanation', `# Memory Explanation\n\n${result.node.content.raw}\n\n- ID: \`${result.node.id}\`\n- Incoming edges: ${result.incoming_edges.length}\n- Outgoing edges: ${result.outgoing_edges.length}\n\n## State\n\n\`\`\`json\n${JSON.stringify(result.node.state, null, 2)}\n\`\`\`\n`);
        }),
        vscode.commands.registerCommand('longmemory.reinforce', async (item?: memory_item) => {
            const id = item?.memory.id ?? await vscode.window.showInputBox({ title: 'Reinforce memory', prompt: 'Memory ID' });
            if (!id) return;
            const result = await run('Reinforcing memory', () => cli.run<{ activation: number }>(['maintenance', 'reinforce', id], { resource: item?.resource ?? cli.current_resource() }));
            if (result) { vscode.window.showInformationMessage(`Memory reinforced to ${result.activation.toFixed(3)} activation.`); await refresh_after_write(); }
        }),
        vscode.commands.registerCommand('longmemory.runDecay', async () => {
            const confirmation = await vscode.window.showWarningMessage('Run bounded decay maintenance across this workspace?', { modal: true }, 'Run Decay');
            if (!confirmation) return;
            const result = await run('Running decay maintenance', () => cli.run<{ scanned: number; updated: number }>(['maintenance', 'decay', '--all'], { timeout_ms: 120_000, resource: cli.current_resource() }));
            if (result) { vscode.window.showInformationMessage(`Decay scanned ${result.scanned} and updated ${result.updated} memories.`); await refresh_after_write(); }
        }),
        vscode.commands.registerCommand('longmemory.startAgentSession', () => run('Starting AI change session', () => tracker.start())),
        vscode.commands.registerCommand('longmemory.stopAgentSession', () => run('Stopping AI change session', () => tracker.stop())),
        vscode.commands.registerCommand('longmemory.reviewAgentChanges', () => run('Reviewing AI changes', () => tracker.review())),
        vscode.commands.registerCommand('longmemory.discardAgentChanges', async () => {
            const confirmation = await vscode.window.showWarningMessage('Discard all pending AI change candidates?', { modal: true }, 'Discard');
            if (confirmation) tracker.discard_all();
        }),
        vscode.commands.registerCommand('longmemory.importSessions', async () => {
            const resource = cli.current_resource();
            if (!resource) { vscode.window.showWarningMessage('Open a workspace before importing coding sessions.'); return; }
            const detected = await run('Detecting coding sessions', () => cli.run<harness_detection_result>(['detect'], { resource }));
            if (!detected) return;
            const available = detected.harnesses.filter((item) => item.can_import);
            if (!available.length) { vscode.window.showInformationMessage('No readable supported AI conversation stores were found.'); return; }
            const source = await vscode.window.showQuickPick(available.map((item) => ({
                label: harness_labels[item.harness],
                description: item.source_path ?? undefined,
                detail: item.note ?? 'Ready to import',
                harness: item.harness,
            })), { title: 'Import Coding Sessions · Source', placeHolder: 'Choose a local coding harness' });
            if (!source) return;
            const discovered = await run(`Reading ${source.label} sessions`, () => cli.run<session_discovery_result>(['session', 'discover', '--from', source.harness, '--limit', '200'], { resource, timeout_ms: 120_000 }));
            if (!discovered?.count) { vscode.window.showInformationMessage(`${source.label} has no portable sessions.`); return; }
            const sessions = discovered.projects.flatMap((project) => project.sessions.map((session) => ({
                label: session.title || session.source_session_id,
                description: `${session.turns.length} turns${session.updated_at ? ` · ${new Date(session.updated_at).toLocaleDateString()}` : ''}`,
                detail: project.cwd || 'Unknown project',
                picked: false,
                id: session.source_session_id,
            })));
            const selected = await vscode.window.showQuickPick(sessions, { title: `Import from ${source.label}`, placeHolder: 'Select sessions to import as governed Chat Memory', canPickMany: true, matchOnDescription: true, matchOnDetail: true });
            if (!selected?.length) return;
            const config = vscode.workspace.getConfiguration('longmemory', resource);
            const agent_id = config.get<string>('agentId', '').trim() || source.harness;
            const args = ['port', '--from', source.harness, '--to', 'longmemory', '--agent', agent_id, ...selected.flatMap((item) => ['--id', item.id])];
            const imported = await run(`Importing ${selected.length} session${selected.length === 1 ? '' : 's'}`, () => cli.run<session_port_result>(args, { resource, timeout_ms: 300_000 }));
            if (!imported) return;
            await refresh_after_write();
            const summary = `${imported.counts.created} created · ${imported.counts.updated} updated · ${imported.counts.skipped} unchanged${imported.counts.errors ? ` · ${imported.counts.errors} failed` : ''}`;
            if (imported.counts.errors) {
                const action = await vscode.window.showWarningMessage(`Session import finished: ${summary}`, 'Open Output');
                if (action) output.show(true);
            } else vscode.window.showInformationMessage(`Session import finished: ${summary}`);
        }),
        vscode.commands.registerCommand('longmemory.openSettings', () => vscode.commands.executeCommand('workbench.action.openSettings', '@ext:CaviraOSS.longmemory-vscode')),
        vscode.commands.registerCommand('longmemory.showActions', async () => {
            const action = await vscode.window.showQuickPick([
                { label: 'Workspace Memory', kind: vscode.QuickPickItemKind.Separator, command: '' },
                { label: '$(search) Recall context', description: 'Search governed memory', command: 'longmemory.recall' },
                { label: '$(edit) Remember a note', description: 'Store a durable project memory', command: 'longmemory.quickNote' },
                { label: '$(repo) Build project context', description: 'Create an agent-ready coding brief', command: 'longmemory.projectContext' },
                { label: '$(repo-pull) Import AI conversations', description: 'Terminal and code-editor agents', command: 'longmemory.importSessions' },
                { label: 'AI Change Memory', kind: vscode.QuickPickItemKind.Separator, command: '' },
                { label: tracker_status.active ? '$(debug-stop) Stop AI change session' : '$(record) Start AI change session', command: tracker_status.active ? 'longmemory.stopAgentSession' : 'longmemory.startAgentSession' },
                ...(tracker_status.pending ? [{ label: `$(diff) Review ${tracker_status.pending} AI change candidate(s)`, command: 'longmemory.reviewAgentChanges' }] : []),
                { label: 'Management', kind: vscode.QuickPickItemKind.Separator, command: '' },
                { label: '$(refresh) Refresh memories', command: 'longmemory.refresh' },
                { label: '$(database) Initialize workspace', command: 'longmemory.initialize' },
                { label: '$(gear) Open settings', command: 'longmemory.openSettings' },
                { label: '$(output) Open output', command: 'longmemory.openOutput' },
            ], { title: 'LongMemory actions' });
            if (action?.command) await vscode.commands.executeCommand(action.command);
        }),
        vscode.commands.registerCommand('longmemory.openOutput', () => output.show(true)),
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration('longmemory')) void refresh();
        }),
        vscode.window.onDidChangeActiveTextEditor(() => void refresh()),
    );

    void refresh();
}

export function deactivate(): void { }
