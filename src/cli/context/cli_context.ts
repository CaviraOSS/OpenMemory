import type { open_memory, recall_mode } from '../../core/create_memory.js';
import type { project_memory } from '../../core/project/project_memory.js';
import { create_embedding_environment } from '../../core/embeddings/environment.js';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { create_colors, type cli_colors } from '../theme/colors.js';
import { terminal_width as detect_width } from '../theme/layout.js';
import { cli_error, exit_codes } from '../output/errors.js';
import { assert_known_global, flag_value, has_flag, resolved_config, type parsed_cli } from './config_loader.js';

export type cli_io = { stdout(value: string): void; stderr(value: string): void; terminal?: boolean };
export type cli_command = (context: cli_context) => Promise<void>;

export type cli_context = {
    args: parsed_cli; env: NodeJS.ProcessEnv; io: cli_io; cwd: string; db_path: string; project_id: string;
    project_name: string; user_id: string; json: boolean; human: boolean; color: boolean; colors: cli_colors;
    silent: boolean; interactive: boolean; token_budget: number; dry_run: boolean; terminal_width: number; is_tty: boolean;
    pretty: boolean; compact: boolean; debug: boolean; jsonl: boolean; exit_code: number;
};

export const default_io = (): cli_io => ({
    stdout: (value) => process.stdout.write(`${value}\n`),
    stderr: (value) => process.stderr.write(value.endsWith('\n') ? value : `${value}\n`),
    terminal: Boolean(process.stdout.isTTY),
});

export function create_cli_context(args: parsed_cli, env: NodeJS.ProcessEnv, io: cli_io): cli_context {
    const config = resolved_config(args, env);
    const is_tty = io.terminal ?? Boolean(process.stdout.isTTY);
    const jsonl = has_flag(args, 'jsonl');
    const json = has_flag(args, 'json') || jsonl || !is_tty;
    const color = !json && !has_flag(args, 'no-color') && env.NO_COLOR === undefined && env.TERM !== 'dumb';
    return {
        args, env, io, ...config, json, human: !json, color, colors: create_colors(color),
        silent: has_flag(args, 'silent'), interactive: has_flag(args, 'interactive') && is_tty,
        token_budget: config.token_budget, dry_run: has_flag(args, 'dry-run'), terminal_width: detect_width(), is_tty,
        pretty: has_flag(args, 'pretty') && !has_flag(args, 'compact'), compact: has_flag(args, 'compact'), debug: has_flag(args, 'debug'), jsonl,
        exit_code: exit_codes.success,
    };
}

export const flag = (context: cli_context, key: string) => flag_value(context.args, key);
export const flags = (context: cli_context, key: string): string[] => {
    const value = context.args.flags.get(key);
    return Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
};
export const has = (context: cli_context, key: string) => has_flag(context.args, key);
export const positional = (context: cli_context, index = 0) => context.args.positionals[index];
export const require_value = (value: string | undefined, label: string): string => {
    if (!value?.trim()) throw new cli_error('validation_error', `${label} is required`, exit_codes.validation, {}, `openmemory help`, `Provide ${label}.`);
    return value.trim();
};
export const number_flag = (context: cli_context, key: string, fallback?: number) => {
    const raw = flag(context, key);
    if (raw === undefined) return fallback;
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new cli_error('validation_error', `--${key} must be a number`, exit_codes.validation);
    return value;
};
export const time_flag = (context: cli_context, key: string) => {
    const raw = flag(context, key);
    if (raw === undefined) return undefined;
    const numeric = Number(raw);
    if (Number.isFinite(numeric)) return numeric;
    const parsed = Date.parse(raw);
    if (!Number.isFinite(parsed)) throw new cli_error('validation_error', `--${key} must be epoch milliseconds or an ISO date`, exit_codes.validation);
    return parsed;
};
export const list_flag = (context: cli_context, key: string) => (flag(context, key) ?? '').split(',').map((value) => value.trim()).filter(Boolean);
export const mode_flag = (context: cli_context, fallback?: recall_mode): recall_mode => {
    const mode = flag(context, 'mode') ?? fallback;
    if (!mode) throw new cli_error('validation_error', '--mode is required', exit_codes.validation, {}, 'openmemory recall "your query" --mode strict');
    const modes: recall_mode[] = ['strict', 'historical', 'associative', 'world_grounded'];
    if (!modes.includes(mode as recall_mode)) throw new cli_error('validation_error', `--mode must be one of ${modes.join(', ')}`, exit_codes.validation);
    return mode as recall_mode;
};
export const command_flags = (context: cli_context, local: readonly string[]) => {
    try { assert_known_global(context.args, local); }
    catch (error) { throw new cli_error('validation_error', error instanceof Error ? error.message : String(error), exit_codes.validation); }
};

export const memory_config = (context: cli_context) => {
    const embeddings = create_embedding_environment(context.env, { logger: (message) => context.io.stderr(`[openmemory] ${message}\n`) });
    return {
        store: 'sqlite' as const, db_path: context.db_path, tenant_id: 'default', user_id: 'default',
        ...(embeddings ? { embedding_provider: embeddings.embedding_provider, multilingual_embedding_provider: embeddings.multilingual_embedding_provider, embedding_dimension: embeddings.embedding_dimension } : {}),
    };
};
export async function with_memory<T>(context: cli_context, operation: (memory: open_memory) => Promise<T>): Promise<T> {
    const readonly = context.dry_run && context.db_path !== ':memory:';
    if (readonly && !existsSync(context.db_path)) throw new cli_error('database_not_found', 'Dry-run reads require an existing database', exit_codes.database, { db_path: context.db_path }, 'openmemory init');
    if (!readonly && context.db_path !== ':memory:') mkdirSync(dirname(context.db_path), { recursive: true });
    const { createMemory: create_memory } = await import('../../core/create_memory.js');
    const memory = create_memory({ ...memory_config(context), readonly });
    try { return await operation(memory); } finally { await memory.close(); }
}
export async function with_project<T>(context: cli_context, operation: (project: project_memory) => Promise<T>): Promise<T> {
    const readonly = context.dry_run && context.db_path !== ':memory:';
    if (readonly && !existsSync(context.db_path)) throw new cli_error('database_not_found', 'Dry-run reads require an existing project database', exit_codes.database, { db_path: context.db_path }, 'openmemory project init');
    if (!readonly && context.db_path !== ':memory:') mkdirSync(dirname(context.db_path), { recursive: true });
    const [{ createMemory: create_memory }, { project_memory }] = await Promise.all([import('../../core/create_memory.js'), import('../../core/project/project_memory.js')]);
    const memory = create_memory({ ...memory_config(context), readonly });
    const project = new project_memory({ memory, tenant_id: 'default', project_id: context.project_id, name: context.project_name, max_context_tokens: context.token_budget, readonly });
    try {
        await project.createProject({ tenant_id: 'default', project_id: context.project_id, name: context.project_name });
        return await operation(project);
    } finally { await project.close(); await memory.close(); }
}
export async function with_read_memory<T>(context: cli_context, operation: (memory: open_memory) => Promise<T>): Promise<T> {
    if (context.db_path !== ':memory:' && !existsSync(context.db_path)) throw new cli_error('database_not_found', 'OpenMemory is not initialized for this workspace', exit_codes.database, { db_path: context.db_path }, 'openmemory init');
    const { createMemory: create_memory } = await import('../../core/create_memory.js');
    const memory = create_memory({ ...memory_config(context), readonly: context.db_path !== ':memory:' });
    try { return await operation(memory); } finally { await memory.close(); }
}