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
 *  file  : apps/vscode-extension/src/status_bar.ts
 *  usage : supports the LongMemory VS Code extension status bar
 */

import * as vscode from 'vscode';
import type { status_result } from './types.js';
import { build_status_bar_model } from './status_bar_model.js';

type tracker_state = { active: string | null; pending: number };

export class memory_status_bar implements vscode.Disposable {
    private readonly memory = vscode.window.createStatusBarItem('longmemory.manager', vscode.StatusBarAlignment.Right, 120);
    private readonly activity = vscode.window.createStatusBarItem('longmemory.activity', vscode.StatusBarAlignment.Right, 119);

    constructor() {
        this.memory.name = 'LongMemory Manager';
        this.memory.command = 'longmemory.showActions';
        this.memory.text = '$(database) Memory';
        this.memory.tooltip = 'LongMemory is loading. Click to manage workspace memory.';
        this.memory.accessibilityInformation = { label: 'LongMemory manager' };
        this.memory.show();
        this.activity.name = 'LongMemory AI Changes';
        this.activity.command = 'longmemory.showActions';
        this.activity.accessibilityInformation = { label: 'LongMemory AI change activity' };
    }

    update(value: status_result | null, tracker: tracker_state, error?: string): void {
        const model = build_status_bar_model(value, tracker, error);
        this.memory.text = model.memory_text;
        this.memory.tooltip = model.memory_tooltip;
        this.memory.backgroundColor = model.memory_severity === 'error' ? new vscode.ThemeColor('statusBarItem.errorBackground')
            : model.memory_severity === 'warning' ? new vscode.ThemeColor('statusBarItem.warningBackground') : undefined;
        this.memory.accessibilityInformation = { label: value ? `LongMemory manager, ${value.memory.active} active memories` : model.memory_severity === 'error' ? 'LongMemory unavailable' : 'LongMemory manager' };

        if (model.activity) {
            this.activity.text = model.activity.text;
            this.activity.tooltip = model.activity.tooltip;
            this.activity.command = model.activity.review ? 'longmemory.reviewAgentChanges' : 'longmemory.showActions';
            this.activity.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            this.activity.show();
        } else {
            this.activity.hide();
            this.activity.command = 'longmemory.showActions';
            this.activity.backgroundColor = undefined;
        }
    }

    dispose(): void {
        this.memory.dispose();
        this.activity.dispose();
    }
}
