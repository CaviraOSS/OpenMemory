import * as vscode from 'vscode';
import type { status_result } from './types.js';
import { build_status_bar_model } from './status_bar_model.js';

type tracker_state = { active: string | null; pending: number };

export class memory_status_bar implements vscode.Disposable {
    private readonly memory = vscode.window.createStatusBarItem('openmemory.manager', vscode.StatusBarAlignment.Right, 120);
    private readonly activity = vscode.window.createStatusBarItem('openmemory.activity', vscode.StatusBarAlignment.Right, 119);

    constructor() {
        this.memory.name = 'OpenMemory Manager';
        this.memory.command = 'openmemory.showActions';
        this.memory.text = '$(database) Memory';
        this.memory.tooltip = 'OpenMemory is loading. Click to manage workspace memory.';
        this.memory.accessibilityInformation = { label: 'OpenMemory manager' };
        this.memory.show();
        this.activity.name = 'OpenMemory AI Changes';
        this.activity.command = 'openmemory.showActions';
        this.activity.accessibilityInformation = { label: 'OpenMemory AI change activity' };
    }

    update(value: status_result | null, tracker: tracker_state, error?: string): void {
        const model = build_status_bar_model(value, tracker, error);
        this.memory.text = model.memory_text;
        this.memory.tooltip = model.memory_tooltip;
        this.memory.backgroundColor = model.memory_severity === 'error' ? new vscode.ThemeColor('statusBarItem.errorBackground')
            : model.memory_severity === 'warning' ? new vscode.ThemeColor('statusBarItem.warningBackground') : undefined;
        this.memory.accessibilityInformation = { label: value ? `OpenMemory manager, ${value.memory.active} active memories` : model.memory_severity === 'error' ? 'OpenMemory unavailable' : 'OpenMemory manager' };

        if (model.activity) {
            this.activity.text = model.activity.text;
            this.activity.tooltip = model.activity.tooltip;
            this.activity.command = model.activity.review ? 'openmemory.reviewAgentChanges' : 'openmemory.showActions';
            this.activity.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            this.activity.show();
        } else {
            this.activity.hide();
            this.activity.command = 'openmemory.showActions';
            this.activity.backgroundColor = undefined;
        }
    }

    dispose(): void {
        this.memory.dispose();
        this.activity.dispose();
    }
}
