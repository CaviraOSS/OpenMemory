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
 *  file  : src/cli/porter/adapters/deepseek_harness.ts
 *  usage : implements the LongMemory deepseek harness component
 */

import { readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { derive_session_preview } from '../preview.js';
import { is_directory, is_readable, walk_files } from '../filesystem.js';
import type { harness_capability, import_adapter, portable_session, portable_turn, session_ref } from '../types.js';
import { object, text_content, type json } from './shared.js';

const root = (env: NodeJS.ProcessEnv) => env.LONGMEMORY_DEEPSEEK_HARNESS_SESSIONS ?? env.DSH_SESSION_ROOT ?? join(env.DSH_HOME ?? join(env.HOME ?? homedir(), '.dsh'), 'sessions');
const raw_records = (path: string): json[] => {
    if (path.endsWith('.zstd')) throw new Error('DeepSeek Harness Zstandard logs require a raw export or LONGMEMORY_DEEPSEEK_HARNESS_SESSIONS pointing to a compression:none session root');
    return readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean).flatMap((line) => { try { return [object(JSON.parse(line))]; } catch { return []; } });
};
const chunk_text = (record: json) => text_content(record.data?.chunk?.text ?? record.data?.text ?? record.data?.message ?? record.data?.content);
const parse_file = (path: string): portable_session => {
    const values = raw_records(path); const header = values.find((value) => value.type === 'session') ?? {};
    const turns: portable_turn[] = []; let assistant = ''; let assistant_at: number | undefined; let dropped_turns = 0;
    const flush = () => { if (assistant.trim()) turns.push({ role: 'assistant', text: assistant.trim(), timestamp: assistant_at }); assistant = ''; assistant_at = undefined; };
    for (const value of values) {
        if (value.type === 'user/message') { flush(); const text = chunk_text(value); if (text) turns.push({ role: 'user', text, timestamp: value.time }); else dropped_turns++; }
        else if (value.type === 'assistant/chunk') { const text = chunk_text(value); if (text) { assistant += text; assistant_at ??= value.time; } else dropped_turns++; }
        else if (value.type === 'text-chunks' && Array.isArray(value.data?.texts)) { assistant += value.data.texts.filter((item: unknown): item is string => typeof item === 'string').join(''); assistant_at ??= value.time0; }
        else if (value.type === 'assistant/message') { flush(); const text = chunk_text(value); if (text) turns.push({ role: 'assistant', text, timestamp: value.time }); else dropped_turns++; }
        else if (!['session', 'turn/start', 'turn/end', 'step/start', 'step/end'].includes(value.type)) dropped_turns++;
    }
    flush();
    const source_session_id = String(header.id ?? basename(dirname(path)));
    return { schema_version: '1.0.0', source_harness: 'deepseek-harness', source_session_id, source_path: path, cwd: typeof header.cwd === 'string' ? header.cwd : '', title: derive_session_preview(turns.filter((turn) => turn.role === 'user').map((turn) => turn.text)) || source_session_id, created_at: header.createdAt, updated_at: turns.at(-1)?.timestamp ?? statSync(path).mtimeMs, turns, dropped_turns, source_metadata: { version: header.version, agent_preset: header.agentPreset, encoding: 'none' } };
};

export const deepseek_harness_adapter: import_adapter = {
    harness: 'deepseek-harness',
    detect(env = process.env): harness_capability {
        const path = root(env); const readable = is_directory(path) && is_readable(path);
        const raw = readable && walk_files(path, (item) => item.endsWith('session.jsonl')).length > 0;
        const compressed = readable && walk_files(path, (item) => item.endsWith('session.jsonl.zstd')).length > 0;
        return { harness: 'deepseek-harness', installed: readable, can_import: raw, source_path: readable ? path : null, note: raw ? null : compressed ? 'Compressed DeepSeek logs detected; configure a compression:none root or raw export' : 'DeepSeek Harness session root was not found or has no raw JSONL logs' };
    },
    discover(env = process.env): session_ref[] {
        return walk_files(root(env), (path) => path.endsWith('session.jsonl')).flatMap((path) => {
            try { const value = parse_file(path); return value.turns.length ? [{ harness: 'deepseek-harness' as const, source_session_id: value.source_session_id, source_path: path, title: value.title, cwd: value.cwd, updated_at: value.updated_at }] : []; }
            catch { return []; }
        }).sort((left, right) => (right.updated_at ?? 0) - (left.updated_at ?? 0));
    },
    parse(ref): portable_session { return parse_file(ref.source_path); },
};