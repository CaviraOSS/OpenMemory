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
 *  file  : src/cli/porter/adapters/claude_code.ts
 *  usage : implements the LongMemory claude code component
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import { readFileSync, statSync } from 'node:fs';
import { derive_session_preview } from '../preview.js';
import { is_directory, is_readable, walk_files } from '../filesystem.js';
import type { harness_capability, import_adapter, portable_session, portable_turn, session_ref } from '../types.js';

type json = Record<string, any>;

const projects_root = (env: NodeJS.ProcessEnv): string => env.LONGMEMORY_CLAUDE_PROJECTS
    ?? join(env.CLAUDE_CONFIG_DIR ?? env.HOME ?? homedir(), env.CLAUDE_CONFIG_DIR ? 'projects' : '.claude/projects');

const timestamp = (value: unknown): number | undefined => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'string') return undefined;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : undefined;
};

const content_text = (content: unknown): { text: string; dropped: number } => {
    if (typeof content === 'string') return { text: content.trim(), dropped: 0 };
    if (!Array.isArray(content)) return { text: '', dropped: content ? 1 : 0 };
    const text: string[] = [];
    let dropped = 0;
    for (const block of content) {
        if (!block || typeof block !== 'object') { dropped++; continue; }
        if (block.type === 'text' && typeof block.text === 'string') text.push(block.text);
        else if (block.type === 'tool_result' && typeof block.content === 'string') text.push(block.content);
        else dropped++;
    }
    return { text: text.join('\n').trim(), dropped };
};

const parse_file = (path: string): portable_session => {
    const turns: portable_turn[] = [];
    const skipped_lines: Array<{ line: number; reason: string }> = [];
    let dropped_turns = 0;
    let source_session_id = path.split(/[\\/]/).pop()?.replace(/\.jsonl$/i, '') ?? path;
    let cwd = '';
    let model: string | undefined;
    const lines = readFileSync(path, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
        if (!line.trim()) return;
        let value: json;
        try { value = JSON.parse(line) as json; }
        catch (error) { skipped_lines.push({ line: index + 1, reason: error instanceof Error ? error.message : String(error) }); return; }
        if (typeof value.sessionId === 'string') source_session_id = value.sessionId;
        if (typeof value.cwd === 'string') cwd = value.cwd;
        const message = value.message && typeof value.message === 'object' ? value.message as json : value;
        const role = message.role ?? value.type;
        if (role !== 'user' && role !== 'assistant') return;
        const content = content_text(message.content);
        dropped_turns += content.dropped;
        if (!content.text) { dropped_turns++; return; }
        if (role === 'assistant' && typeof message.model === 'string') model = message.model;
        turns.push({ role, text: content.text, timestamp: timestamp(value.timestamp ?? message.timestamp), ...(role === 'assistant' && model ? { model } : {}) });
    });
    const title = derive_session_preview(turns.filter((turn) => turn.role === 'user').map((turn) => turn.text)) || source_session_id;
    return {
        schema_version: '1.0.0', source_harness: 'claude-code', source_session_id, source_path: path, cwd, title,
        created_at: turns.find((turn) => turn.timestamp !== undefined)?.timestamp,
        updated_at: [...turns].reverse().find((turn) => turn.timestamp !== undefined)?.timestamp,
        turns, dropped_turns, source_metadata: { line_count: lines.length, skipped_lines },
    };
};

export const claude_code_adapter: import_adapter = {
    harness: 'claude-code',
    detect(env = process.env): harness_capability {
        const root = projects_root(env);
        const installed = is_directory(root) || is_directory(join(root, '..'));
        const can_import = is_directory(root) && is_readable(root);
        return { harness: 'claude-code', installed, can_import, source_path: can_import ? root : null, note: can_import ? null : 'Claude Code projects directory was not found or is not readable' };
    },
    discover(env = process.env): session_ref[] {
        return walk_files(projects_root(env), (path) => path.toLocaleLowerCase().endsWith('.jsonl')).flatMap((path) => {
            try {
                const session = parse_file(path);
                if (!session.turns.length) return [];
                return [{ harness: 'claude-code' as const, source_session_id: session.source_session_id, source_path: path, title: session.title, cwd: session.cwd, updated_at: session.updated_at ?? statSync(path).mtimeMs }];
            } catch { return []; }
        }).sort((left, right) => (right.updated_at ?? 0) - (left.updated_at ?? 0));
    },
    parse(ref): portable_session { return parse_file(ref.source_path); },
};