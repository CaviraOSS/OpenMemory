import { readFileSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { derive_session_preview } from '../preview.js';
import { is_directory, is_readable, walk_files } from '../filesystem.js';
import type { harness_capability, import_adapter, portable_session, portable_turn, session_ref } from '../types.js';
import { editor_storage_roots, object, text_content } from './shared.js';

const editor_roots = (env: NodeJS.ProcessEnv): string[] => {
    if (env.OPENMEMORY_CLINE_TASKS) return [env.OPENMEMORY_CLINE_TASKS];
    const extensions = ['saoudrizwan.claude-dev', 'cline.cline'];
    return editor_storage_roots(env).flatMap((root) => extensions.map((extension) => join(root, 'globalStorage', extension, 'tasks')));
};
const parse_file = (path: string): portable_session => {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown;
    const messages = Array.isArray(raw) ? raw : Array.isArray(object(raw).messages) ? object(raw).messages : [];
    const turns: portable_turn[] = [];
    let dropped_turns = 0;
    for (const raw_message of messages) {
        const message = object(raw_message);
        if (!['user', 'assistant'].includes(message.role)) continue;
        const text = text_content(message.content);
        if (!text) { dropped_turns++; continue; }
        const model = object(message.modelInfo).id;
        turns.push({ role: message.role, text, ...(typeof message.ts === 'number' ? { timestamp: message.ts } : {}), ...(message.role === 'assistant' && typeof model === 'string' ? { model } : {}) });
        if (Array.isArray(message.content)) dropped_turns += message.content.filter((part: unknown) => object(part).type !== 'text').length;
    }
    const source_session_id = basename(dirname(path));
    return {
        schema_version: '1.0.0', source_harness: 'cline', source_session_id, source_path: path, cwd: '',
        title: derive_session_preview(turns.filter((turn) => turn.role === 'user').map((turn) => turn.text)) || source_session_id,
        created_at: turns[0]?.timestamp, updated_at: turns.at(-1)?.timestamp ?? statSync(path).mtimeMs,
        turns, dropped_turns, source_metadata: { format: 'anthropic_messages', task_directory: dirname(path) },
    };
};

export const cline_adapter: import_adapter = {
    harness: 'cline',
    detect(env = process.env): harness_capability {
        const path = editor_roots(env).find((item) => is_directory(item) && is_readable(item));
        return { harness: 'cline', installed: Boolean(path), can_import: Boolean(path), source_path: path ?? null, note: path ? null : 'Cline task history was not found in supported editor storage' };
    },
    discover(env = process.env): session_ref[] {
        return editor_roots(env).flatMap((root) => walk_files(root, (path) => path.endsWith('api_conversation_history.json'))).flatMap((path) => {
            try { const value = parse_file(path); return value.turns.length ? [{ harness: 'cline' as const, source_session_id: value.source_session_id, source_path: path, title: value.title, cwd: value.cwd, updated_at: value.updated_at }] : []; }
            catch { return []; }
        }).sort((left, right) => (right.updated_at ?? 0) - (left.updated_at ?? 0));
    },
    parse(ref): portable_session { return parse_file(ref.source_path); },
};