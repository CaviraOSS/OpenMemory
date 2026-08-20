import * as vscode from 'vscode';
import { openmemory_cli } from './cli.js';
import type { memory_summary, status_result } from './types.js';

export class memory_item extends vscode.TreeItem {
    constructor(readonly memory: memory_summary, readonly resource?: vscode.Uri) {
        super(memory.text, vscode.TreeItemCollapsibleState.None);
        this.id = memory.id;
        this.description = `${memory.status} · ${memory.activation.toFixed(2)}`;
        this.contextValue = 'openmemory.memory';
        this.iconPath = new vscode.ThemeIcon(memory.status === 'active' ? 'circle-filled' : memory.status === 'contradicted' ? 'warning' : 'history');
        this.command = { command: 'openmemory.explain', title: 'Explain Memory', arguments: [this] };
        const tooltip = new vscode.MarkdownString(undefined, true);
        tooltip.appendMarkdown(`**${memory.status.toUpperCase()}**  \n`);
        tooltip.appendText(memory.text);
        tooltip.appendMarkdown(`\n\n- Confidence: ${memory.confidence.toFixed(3)}\n- Salience: ${memory.salience.toFixed(3)}\n- Activation: ${memory.activation.toFixed(3)}\n- Grounded: ${memory.grounded ? 'yes' : 'no'}\n- Observed: ${new Date(memory.observed_at).toLocaleString()}\n- ID: \`${memory.id}\``);
        this.tooltip = tooltip;
    }
}

export class memory_tree implements vscode.TreeDataProvider<memory_item> {
    private readonly changed = new vscode.EventEmitter<memory_item | undefined | null | void>();
    readonly onDidChangeTreeData = this.changed.event;
    private values: memory_summary[] = [];
    private resource: vscode.Uri | undefined;
    private refresh_version = 0;
    private message = 'OpenMemory has not loaded this workspace yet.';
    status: status_result | null = null;

    constructor(private readonly cli: openmemory_cli, private readonly on_status: (status: status_result | null, error?: string) => void) { }

    getTreeItem(element: memory_item): vscode.TreeItem { return element; }

    getChildren(): memory_item[] {
        return this.values.map((memory) => new memory_item(memory, this.resource));
    }

    async refresh(): Promise<void> {
        const version = ++this.refresh_version;
        try {
            this.resource = this.cli.current_resource();
            if (!this.resource) throw new Error('Open a workspace before using OpenMemory.');
            if (!this.cli.is_initialized(this.resource)) {
                this.status = null;
                this.values = [];
                this.message = 'OpenMemory is not initialized. Run Initialize Workspace Memory.';
                this.on_status(null, this.message);
                this.changed.fire();
                return;
            }
            const limit = vscode.workspace.getConfiguration('openmemory', this.resource).get<number>('listLimit', 50);
            const status = await this.cli.run<status_result>(['status', '--memories', String(limit)], { resource: this.resource });
            if (version !== this.refresh_version) return;
            this.status = status;
            this.values = status.recent_memories;
            this.message = status.recent_memories.length ? '' : 'No project memories yet. Remember a selection or quick note.';
            this.on_status(status);
        } catch (error) {
            if (version !== this.refresh_version) return;
            this.status = null;
            this.values = [];
            this.message = error instanceof Error ? error.message : String(error);
            this.on_status(null, this.message);
        }
        this.changed.fire();
    }

    get empty_message(): string { return this.message; }
}
