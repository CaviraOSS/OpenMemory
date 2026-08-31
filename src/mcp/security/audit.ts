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
 *  file  : src/mcp/security/audit.ts
 *  usage : implements the LongMemory audit component
 */


import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { mcp_tool_name } from './tool_allowlist.js';

export type mcp_audit_entry = {
    id: string;
    tool: mcp_tool_name;
    user_id: string;
    project_id: string | null;
    outcome: 'allowed' | 'denied' | 'error';
    dry_run: boolean | null;
    started_at: number;
    completed_at: number;
    duration_ms: number;
    error: string | null;
};

export class mcp_audit_log {
    private readonly values: mcp_audit_entry[] = [];

    constructor(private readonly path: string | null = null) {}

    record(entry: Omit<mcp_audit_entry, 'id' | 'duration_ms'>): mcp_audit_entry {
        const value: mcp_audit_entry = {
            ...entry,
            id: `mcp-audit:${entry.started_at}:${this.values.length + 1}`,
            duration_ms: Math.max(0, entry.completed_at - entry.started_at),
        };
        this.values.push(value);
        if (this.path) {
            mkdirSync(dirname(this.path), { recursive: true });
            appendFileSync(this.path, `${JSON.stringify(value)}\n`, 'utf8');
        }
        return value;
    }

    entries(): readonly mcp_audit_entry[] {
        return [...this.values];
    }
}