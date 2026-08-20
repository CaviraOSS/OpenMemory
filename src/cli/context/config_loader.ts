import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { detect_cwd_project } from './cwd_project.js';

export type cli_value = string | boolean | string[];
export type parsed_cli = { command: string; flags: Map<string, cli_value>; positionals: string[] };
export type local_cli_config = {
    db_path?: string; project_id?: string; project_name?: string; user_id?: string; token_budget?: number;
    connectors?: Record<string, Record<string, unknown>>;
};

const bool_flags = new Set(['json', 'jsonl', 'pretty', 'compact', 'no-color', 'silent', 'interactive', 'dry-run', 'help', 'version', 'debug', 'mcp-http', 'read-only', 'all', 'stdin', 'force']);
const global_flags = new Set(['db', 'project', 'user', 'json', 'jsonl', 'pretty', 'compact', 'no-color', 'silent', 'interactive', 'dry-run', 'token-budget', 'cwd', 'help', 'version', 'debug']);

export function parse_argv(argv: string[]): parsed_cli {
    const flags = new Map<string, cli_value>();
    const words: string[] = [];
    for (let index = 0; index < argv.length; index++) {
        const item = argv[index];
        if (item === '--') { words.push(...argv.slice(index + 1)); break; }
        if (!item.startsWith('--')) { words.push(item); continue; }
        const split = item.indexOf('=');
        const key = item.slice(2, split < 0 ? undefined : split);
        if (!key) throw new Error('flag names cannot be empty');
        if (split < 0 && !bool_flags.has(key) && (!argv[index + 1] || argv[index + 1].startsWith('--'))) throw new Error(`--${key} requires a value`);
        const value: string | boolean = split >= 0 ? item.slice(split + 1)
            : bool_flags.has(key) ? true : argv[++index];
        const prior = flags.get(key);
        flags.set(key, prior === undefined ? value : Array.isArray(prior) ? [...prior, String(value)] : [String(prior), String(value)]);
    }
    const group = ['project', 'connectors', 'agent', 'memory', 'maintenance', 'skill', 'code', 'session', 'asset'].includes(words[0]) && words[1] ? `${words.shift()}:${words.shift()}` : words.shift() ?? 'status';
    return { command: group, flags, positionals: words };
}

export const flag_value = (args: parsed_cli, key: string) => {
    const value = args.flags.get(key);
    return Array.isArray(value) ? value.at(-1) : typeof value === 'string' ? value : undefined;
};
export const has_flag = (args: parsed_cli, key: string) => args.flags.has(key);
export const assert_known_global = (args: parsed_cli, local: readonly string[]) => {
    const allowed = new Set([...global_flags, ...local]);
    const unknown = [...args.flags.keys()].find((key) => !allowed.has(key));
    if (unknown) throw new Error(`unknown flag: --${unknown}`);
};

export function load_local_config(root: string): local_cli_config {
    const path = resolve(root, '.openmemory', 'config.json');
    if (!existsSync(path)) return {};
    try { return JSON.parse(readFileSync(path, 'utf8')) as local_cli_config; }
    catch (error) { throw new Error(`invalid OpenMemory config at ${path}: ${error instanceof Error ? error.message : String(error)}`); }
}

export function save_local_config(root: string, config: local_cli_config): string {
    const path = resolve(root, '.openmemory', 'config.json');
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
    return path;
}

export function resolved_config(args: parsed_cli, env: NodeJS.ProcessEnv) {
    const detected = detect_cwd_project(flag_value(args, 'cwd') ?? process.cwd());
    const local = load_local_config(detected.root);
    const budget = Number(flag_value(args, 'token-budget') ?? env.OPENMEMORY_TOKEN_BUDGET ?? local.token_budget ?? 2048);
    if (!Number.isInteger(budget) || budget < 64) throw new Error('--token-budget must be an integer of at least 64');
    const requested_project = flag_value(args, 'project') ?? env.OPENMEMORY_PROJECT_ID ?? local.project_id;
    const requested_db = flag_value(args, 'db') ?? env.OPENMEMORY_DB_PATH ?? local.db_path ?? '.openmemory/project.db';
    return {
        detected, local,
        cwd: detected.cwd,
        db_path: requested_db === ':memory:' ? requested_db : resolve(detected.root, requested_db),
        project_id: !requested_project || requested_project === 'current' ? detected.project_id : requested_project,
        project_name: local.project_name ?? detected.project_name,
        user_id: flag_value(args, 'user') ?? env.OPENMEMORY_USER_ID ?? local.user_id ?? 'default',
        token_budget: budget,
    };
}