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
 *  file  : src/cli/porter/adapters/opencode.ts
 *  usage : implements the LongMemory opencode component
 */


import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import Database from 'better-sqlite3';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { command_on_path, is_file, is_readable } from '../filesystem.js';
import type { harness_capability, import_adapter, portable_session, portable_turn, session_ref } from '../types.js';

type json = Record<string, any>;
const exec_file = promisify(execFile);
const database_path = (env: NodeJS.ProcessEnv): string => env.OPENCODE_DB
    ?? join(env.XDG_DATA_HOME ?? join(env.HOME ?? homedir(), '.local/share'), 'opencode', 'opencode.db');
const object = (value: unknown): json => value && typeof value === 'object' ? value as json : {};
const parsed = (value: unknown): json => {
    if (typeof value !== 'string') return object(value);
    try { return object(JSON.parse(value)); } catch { return {}; }
};
const text_parts = (parts: unknown): string => Array.isArray(parts)
    ? parts.flatMap((part) => part?.type === 'text' && typeof part.text === 'string' ? [part.text] : []).join('\n\n').trim()
    : '';

const portable = (value: json, source_path: string): portable_session => {
    const info = object(value.info);
    const turns: portable_turn[] = [];
    let dropped_turns = 0;
    for (const raw of Array.isArray(value.messages) ? value.messages : []) {
        const message = object(raw);
        const message_info = object(message.info);
        const role = message_info.role === 'assistant' ? 'assistant' as const : 'user' as const;
        const text = text_parts(message.parts);
        if (!text) { dropped_turns++; continue; }
        const model = object(message_info.model).modelID ?? message_info.modelID;
        turns.push({
            role, text,
            ...(typeof object(message_info.time).created === 'number' ? { timestamp: object(message_info.time).created } : {}),
            ...(role === 'assistant' && typeof model === 'string' ? { model } : {}),
        });
    }
    const source_session_id = typeof info.id === 'string' ? info.id : source_path;
    return {
        schema_version: '1.0.0', source_harness: 'opencode', source_session_id, source_path,
        cwd: typeof info.directory === 'string' ? info.directory : '', title: typeof info.title === 'string' ? info.title : source_session_id,
        ...(typeof object(info.time).created === 'number' ? { created_at: object(info.time).created } : {}),
        ...(typeof object(info.time).updated === 'number' ? { updated_at: object(info.time).updated } : {}),
        turns, dropped_turns,
        source_metadata: { project_id: info.projectID, version: info.version, model: info.model, tokens: info.tokens, cost: info.cost },
    };
};

const from_database = (path: string, session_id: string): portable_session => {
    const database = new Database(path, { readonly: true, fileMustExist: true });
    try {
        const row = database.prepare('SELECT id, directory, title, version, project_id, time_created, time_updated FROM session WHERE id = ?').get(session_id) as json | undefined;
        if (!row) throw new Error(`OpenCode session was not found: ${session_id}`);
        const messages = database.prepare('SELECT id, time_created, data FROM message WHERE session_id = ? ORDER BY time_created ASC, id ASC').all(session_id) as json[];
        const parts = database.prepare('SELECT data FROM part WHERE message_id = ? ORDER BY time_created ASC, id ASC');
        return portable({
            info: { id: row.id, directory: row.directory, title: row.title, version: row.version, projectID: row.project_id, time: { created: row.time_created, updated: row.time_updated } },
            messages: messages.map((message) => {
                const data = parsed(message.data);
                return { info: { ...data, id: message.id, time: { created: message.time_created ?? object(data.time).created } }, parts: (parts.all(message.id) as json[]).map((part) => parsed(part.data)) };
            }),
        }, path);
    } finally { database.close(); }
};

const via_cli = async (command: string, session_id: string, env: NodeJS.ProcessEnv): Promise<portable_session> => {
    const result = await exec_file(command, ['export', session_id], { env: { ...env, OPENCODE_DISABLE_CHANNEL_DB: '1' }, maxBuffer: 32 * 1024 * 1024, windowsHide: true });
    return portable(JSON.parse(result.stdout) as json, `opencode://${session_id}`);
};

export const opencode_adapter: import_adapter = {
    harness: 'opencode',
    detect(env = process.env): harness_capability {
        const path = database_path(env);
        const cli = command_on_path('opencode', env);
        const can_import = is_file(path) && is_readable(path);
        return {
            harness: 'opencode', installed: Boolean(cli) || is_file(path), can_import, source_path: can_import ? path : null,
            note: can_import ? (cli ? null : 'OpenCode CLI not on PATH; using read-only SQLite') : 'OpenCode database was not found or is not readable',
        };
    },
    discover(env = process.env): session_ref[] {
        const path = database_path(env);
        if (!is_file(path) || !is_readable(path)) return [];
        const database = new Database(path, { readonly: true, fileMustExist: true });
        try {
            return (database.prepare('SELECT id, title, directory, time_updated FROM session ORDER BY time_updated DESC').all() as json[]).map((row) => ({
                harness: 'opencode', source_session_id: String(row.id), source_path: path, title: String(row.title ?? row.id), cwd: String(row.directory ?? ''),
                ...(typeof row.time_updated === 'number' ? { updated_at: row.time_updated } : {}),
            }));
        } catch { return []; }
        finally { database.close(); }
    },
    async parse(ref, env = process.env): Promise<portable_session> {
        const command = command_on_path('opencode', env);
        if (command) {
            try { return await via_cli(command, ref.source_session_id, env); } catch { }
        }
        return from_database(ref.source_path || database_path(env), ref.source_session_id);
    },
};