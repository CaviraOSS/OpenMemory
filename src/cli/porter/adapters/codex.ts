import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { derive_session_preview } from '../preview.js';
import { is_directory, is_readable, walk_files } from '../filesystem.js';
import type { harness_capability, import_adapter, portable_session, portable_turn, session_ref } from '../types.js';

type json = Record<string, any>;
const sessions_root = (env: NodeJS.ProcessEnv): string => {
    if (env.OPENMEMORY_CODEX_SESSIONS) return env.OPENMEMORY_CODEX_SESSIONS;
    return join(env.CODEX_HOME ?? join(env.HOME ?? homedir(), '.codex'), 'sessions');
};
const epoch = (value: unknown): number | undefined => typeof value === 'number' ? value : typeof value === 'string' && Number.isFinite(Date.parse(value)) ? Date.parse(value) : undefined;
const object = (value: unknown): json => value && typeof value === 'object' ? value as json : {};
const text_parts = (content: unknown, type: string): string => Array.isArray(content) ? content.flatMap((item) => item?.type === type && typeof item.text === 'string' ? [item.text] : []).join('\n').trim() : '';

const parse_file = (path: string): portable_session => {
    const turns: portable_turn[] = [];
    const fallback: portable_turn[] = [];
    const skipped_lines: Array<{ line: number; reason: string }> = [];
    let meta: json = {};
    let cwd = '';
    let dropped_turns = 0;
    const lines = readFileSync(path, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
        if (!line.trim()) return;
        let record: json;
        try { record = JSON.parse(line) as json; }
        catch (error) { skipped_lines.push({ line: index + 1, reason: error instanceof Error ? error.message : String(error) }); return; }
        const payload = object(record.payload);
        if (record.type === 'session_meta' && !Object.keys(meta).length) meta = payload;
        if (record.type === 'turn_context' && typeof payload.cwd === 'string') cwd ||= payload.cwd;
        if (record.type === 'response_item') {
            if (payload.type === 'message' && ['user', 'assistant'].includes(payload.role)) {
                const text = text_parts(payload.content, payload.role === 'user' ? 'input_text' : 'output_text');
                if (text) turns.push({ role: payload.role, text, timestamp: epoch(record.timestamp), ...(payload.role === 'assistant' && typeof payload.model === 'string' ? { model: payload.model } : {}) });
            } else if (['reasoning', 'custom_tool_call', 'custom_tool_call_output', 'function_call', 'function_call_output'].includes(payload.type)) dropped_turns++;
        }
        if (record.type === 'event_msg' && typeof payload.message === 'string') {
            if (payload.type === 'user_message') fallback.push({ role: 'user', text: payload.message.trim(), timestamp: epoch(record.timestamp) });
            if (payload.type === 'agent_message') fallback.push({ role: 'assistant', text: payload.message.trim(), timestamp: epoch(record.timestamp) });
        }
    });
    const selected = turns.length ? turns : fallback;
    const source_session_id = typeof meta.session_id === 'string' ? meta.session_id : path.split(/[\\/]/).pop()?.replace(/\.jsonl$/i, '') ?? path;
    cwd ||= typeof meta.cwd === 'string' ? meta.cwd : '';
    return {
        schema_version: '1.0.0', source_harness: 'codex', source_session_id, source_path: path, cwd,
        title: derive_session_preview(selected.filter((turn) => turn.role === 'user').map((turn) => turn.text)) || source_session_id,
        created_at: epoch(meta.timestamp) ?? selected.find((turn) => turn.timestamp !== undefined)?.timestamp,
        updated_at: [...selected].reverse().find((turn) => turn.timestamp !== undefined)?.timestamp,
        turns: selected, dropped_turns, source_metadata: { cli_version: meta.cli_version, model_provider: meta.model_provider, skipped_lines },
    };
};

export const codex_adapter: import_adapter = {
    harness: 'codex',
    detect(env = process.env): harness_capability {
        const root = sessions_root(env);
        const can_import = is_directory(root) && is_readable(root);
        return { harness: 'codex', installed: can_import || is_directory(join(root, '..')), can_import, source_path: can_import ? root : null, note: can_import ? null : 'Codex sessions directory was not found or is not readable' };
    },
    discover(env = process.env): session_ref[] {
        return walk_files(sessions_root(env), (path) => /(?:rollout-.*|.*)\.jsonl$/i.test(path)).flatMap((path) => {
            try {
                const session = parse_file(path);
                if (!session.turns.length) return [];
                return [{ harness: 'codex' as const, source_session_id: session.source_session_id, source_path: path, title: session.title, cwd: session.cwd, updated_at: session.updated_at }];
            } catch { return []; }
        }).sort((left, right) => (right.updated_at ?? 0) - (left.updated_at ?? 0));
    },
    parse(ref): portable_session { return parse_file(ref.source_path); },
};