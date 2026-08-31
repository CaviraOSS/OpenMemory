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
 *  file  : src/cli/output/errors.ts
 *  usage : implements the LongMemory errors component
 */


import type { cli_context, cli_io } from '../context/cli_context.js';
import { render_json } from './json.js';
import { panel } from './panel.js';

export const exit_codes = {
    success: 0, generic: 1, validation: 2, conflict: 3, grounding: 4, stale: 5,
    permission: 6, connector: 7, benchmark: 8, database: 9,
} as const;

export class cli_error extends Error {
    constructor(
        readonly code: string,
        message: string,
        readonly exit_code: number = exit_codes.generic,
        readonly details: unknown = {},
        readonly suggestion = '',
        readonly fix = '',
    ) { super(message); }
}

export const normalize_error = (error: unknown) => {
    if (error instanceof cli_error) return error;
    const message = error instanceof Error ? error.message : String(error);
    if (/permission|access denied|not allowed/i.test(message)) return new cli_error('permission_denied', message, exit_codes.permission);
    if (/grounding|ungrounded/i.test(message)) return new cli_error('grounding_missing', message, exit_codes.grounding);
    if (/stale|expired/i.test(message)) return new cli_error('stale_memory', message, exit_codes.stale);
    if (/contradict|conflict/i.test(message)) return new cli_error('memory_conflict', message, exit_codes.conflict);
    if (/connector|sync/i.test(message)) return new cli_error('connector_failure', message, exit_codes.connector);
    if (/benchmark/i.test(message)) return new cli_error('benchmark_failed', message, exit_codes.benchmark);
    if (/sqlite|database|integrity|migration/i.test(message)) return new cli_error('database_failure', message, exit_codes.database);
    return new cli_error('command_failed', message);
};

export function render_error(context: cli_context | null, io: cli_io, error: unknown): number {
    const value = normalize_error(error);
    if (!context || context.json) {
        io.stderr(render_json({ ok: false, error: { code: value.code, message: value.message, details: value.details, suggestion: value.suggestion } }, context?.pretty ?? false));
    } else {
        io.stderr(panel('', context.colors, {
            title: `Error: ${value.code}`,
            kind: 'danger', width: context.terminal_width,
            rows: [['Cause', value.message], ['Fix', value.fix || 'Review the command arguments and try again.'], ['Try', value.suggestion || 'longmemory help']],
        }));
    }
    return value.exit_code;
}