import { readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { derive_session_preview } from '../preview.js';
import { is_directory, is_readable, walk_files } from '../filesystem.js';
import type { harness_capability, import_adapter, portable_session, portable_turn, session_ref } from '../types.js';
import { epoch, object, text_content, type json } from './shared.js';

const root = (env: NodeJS.ProcessEnv) => env.OPENMEMORY_GEMINI_SESSIONS ?? join(env.GEMINI_CLI_HOME ?? env.HOME ?? homedir(), env.GEMINI_CLI_HOME ? 'tmp' : '.gemini/tmp');
const records = (path: string): json[] => {
    const text = readFileSync(path, 'utf8');
    if (path.toLocaleLowerCase().endsWith('.jsonl')) return text.split(/\r?\n/).filter(Boolean).flatMap((line) => { try { return [object(JSON.parse(line))]; } catch { return []; } });
    try {
        const value = object(JSON.parse(text));
        return [value, ...(Array.isArray(value.messages) ? value.messages.map(object) : [])];
    } catch { return []; }
};
const parse_file = (path: string): portable_session => {
    const values = records(path);
    const meta = values[0] ?? {};
    const turns: portable_turn[] = [];
    let dropped_turns = 0;
    for (const value of values.slice(1)) {
        if (!['user', 'gemini'].includes(value.type)) continue;
        const text = text_content(value.displayContent ?? value.content);
        if (!text) { dropped_turns++; continue; }
        turns.push({ role: value.type === 'user' ? 'user' : 'assistant', text, timestamp: epoch(value.timestamp), ...(value.type === 'gemini' && typeof value.model === 'string' ? { model: value.model } : {}) });
        dropped_turns += Array.isArray(value.toolCalls) ? value.toolCalls.length : 0;
    }
    const source_session_id = String(meta.sessionId ?? path.split(/[\\/]/).pop()?.replace(/\.jsonl?$/i, '') ?? path);
    const cwd = Array.isArray(meta.directories) && typeof meta.directories[0] === 'string' ? meta.directories[0] : '';
    return {
        schema_version: '1.0.0', source_harness: 'gemini-cli', source_session_id, source_path: path, cwd,
        title: typeof meta.summary === 'string' ? meta.summary : derive_session_preview(turns.filter((turn) => turn.role === 'user').map((turn) => turn.text)) || source_session_id,
        created_at: epoch(meta.startTime) ?? turns[0]?.timestamp, updated_at: epoch(meta.lastUpdated) ?? turns.at(-1)?.timestamp,
        turns, dropped_turns, source_metadata: { project_hash: meta.projectHash, kind: meta.kind, format: path.endsWith('.jsonl') ? 'jsonl' : 'json' },
    };
};

export const gemini_cli_adapter: import_adapter = {
    harness: 'gemini-cli',
    detect(env = process.env): harness_capability {
        const path = root(env); const can_import = is_directory(path) && is_readable(path);
        return { harness: 'gemini-cli', installed: can_import || is_directory(join(path, '..')), can_import, source_path: can_import ? path : null, note: can_import ? null : 'Gemini CLI session directory was not found or is not readable' };
    },
    discover(env = process.env): session_ref[] {
        return walk_files(root(env), (path) => /[\\/]chats[\\/]session-.*\.jsonl?$/i.test(path)).flatMap((path) => {
            try { const value = parse_file(path); return value.turns.length && value.source_metadata.kind !== 'subagent' ? [{ harness: 'gemini-cli' as const, source_session_id: value.source_session_id, source_path: path, title: value.title, cwd: value.cwd, updated_at: value.updated_at ?? statSync(path).mtimeMs }] : []; }
            catch { return []; }
        }).sort((left, right) => (right.updated_at ?? 0) - (left.updated_at ?? 0));
    },
    parse(ref): portable_session { return parse_file(ref.source_path); },
};