import { readFileSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { derive_session_preview } from '../preview.js';
import { is_directory, is_readable, walk_files } from '../filesystem.js';
import type { harness_capability, import_adapter, portable_session, portable_turn, session_ref } from '../types.js';
import { editor_storage_roots, object, text_content, type json } from './shared.js';

const roots = (env: NodeJS.ProcessEnv): string[] => {
    if (env.OPENMEMORY_COPILOT_CHAT_SESSIONS) return [env.OPENMEMORY_COPILOT_CHAT_SESSIONS];
    return editor_storage_roots(env).map((root) => join(root, 'workspaceStorage'));
};
const response_text = (value: unknown): string => {
    if (typeof value === 'string') return value.trim();
    if (!Array.isArray(value)) return '';
    return value.flatMap((part) => typeof part === 'string' ? [part] : [object(part).value?.value, object(part).value, object(part).content].filter((item): item is string => typeof item === 'string')).join('\n').trim();
};
const parse_file = (path: string): portable_session => {
    const lines = readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean).flatMap((line) => { try { return [object(JSON.parse(line))]; } catch { return []; } });
    const payloads: json[] = [];
    for (const line of lines) {
        if (line.kind === 0 && Array.isArray(line.value?.requests)) payloads.push(...line.value.requests.map(object));
        else if (line.kind === 2) payloads.push(object(line.value));
    }
    const turns: portable_turn[] = [];
    let dropped_turns = 0;
    for (const request of payloads) {
        const prompt = text_content(request.message?.text ?? request.message ?? request.prompt);
        if (prompt) turns.push({ role: 'user', text: prompt, ...(typeof request.timestamp === 'number' ? { timestamp: request.timestamp } : {}) });
        const response = response_text(request.response);
        if (response) turns.push({ role: 'assistant', text: response, ...(typeof request.response?.timestamp === 'number' ? { timestamp: request.response.timestamp } : {}) });
        if (!prompt && !response) dropped_turns++;
    }
    const initial = lines.find((line) => line.kind === 0)?.value ?? {};
    const source_session_id = String(initial.sessionId ?? basename(path).replace(/\.jsonl?$/i, ''));
    return {
        schema_version: '1.0.0', source_harness: 'copilot-chat', source_session_id, source_path: path, cwd: dirname(dirname(path)),
        title: String(initial.customTitle ?? derive_session_preview(turns.filter((turn) => turn.role === 'user').map((turn) => turn.text)) ?? source_session_id),
        created_at: typeof initial.creationDate === 'number' ? initial.creationDate : turns[0]?.timestamp,
        updated_at: turns.at(-1)?.timestamp ?? statSync(path).mtimeMs, turns, dropped_turns, source_metadata: { format: 'vscode_chat_jsonl' },
    };
};

export const copilot_chat_adapter: import_adapter = {
    harness: 'copilot-chat',
    detect(env = process.env): harness_capability {
        const path = roots(env).find((item) => is_directory(item) && is_readable(item));
        return { harness: 'copilot-chat', installed: Boolean(path), can_import: Boolean(path), source_path: path ?? null, note: path ? null : 'VS Code-compatible workspace storage was not found' };
    },
    discover(env = process.env): session_ref[] {
        return roots(env).flatMap((root) => walk_files(root, (path) => /[\\/]chatSessions[\\/].*\.jsonl?$/i.test(path))).flatMap((path) => {
            try { const value = parse_file(path); return value.turns.length ? [{ harness: 'copilot-chat' as const, source_session_id: value.source_session_id, source_path: path, title: value.title, cwd: value.cwd, updated_at: value.updated_at }] : []; }
            catch { return []; }
        }).sort((left, right) => (right.updated_at ?? 0) - (left.updated_at ?? 0));
    },
    parse(ref): portable_session { return parse_file(ref.source_path); },
};