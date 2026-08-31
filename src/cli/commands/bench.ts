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
 *  file  : src/cli/commands/bench.ts
 *  usage : implements the LongMemory bench component
 */


import { createMemory as create_memory } from '../../core/create_memory.js';
import type { cli_command } from '../context/cli_context.js';
import { command_flags } from '../context/cli_context.js';
import { cli_error, exit_codes } from '../output/errors.js';
import { emit } from '../output/pretty.js';
import { panel } from '../output/panel.js';
import { table } from '../output/table.js';

export const bench_command: cli_command = async (context) => {
    command_flags(context, []);
    const started_at = performance.now();
    const checks = await run_cli_benchmarks();
    const passed = checks.every((item) => item.passed);
    const result = { ok: passed, command: 'bench', passed, duration_ms: Math.round((performance.now() - started_at) * 1_000) / 1_000, checks };
    if (!passed) throw new cli_error('benchmark_failed', 'One or more benchmark checks failed', exit_codes.benchmark, { checks }, 'longmemory doctor', 'Inspect failed benchmark checks.');
    emit(context, result, () => [panel(`${checks.length}/${checks.length} benchmark checks passed`, context.colors, { title: 'Hydrograph benchmark', kind: 'success', width: context.terminal_width, rows: [['Duration', `${result.duration_ms} ms`]] }), '', table(checks.map((check) => ({ status: check.passed ? context.colors.success('PASS') : context.colors.danger('FAIL'), benchmark: check.name })), [{ key: 'status', label: 'STATUS', width: 8 }, { key: 'benchmark', label: 'BENCHMARK', min: 20 }], context.colors, context.terminal_width)].join('\n'));
};

export async function run_cli_benchmarks() {
    const memory = create_memory();
    try {
        return [
            { name: 'longmemory package surface is available', passed: memory.status().ready },
            { name: 'architecture invariants are available', passed: memory.invariants().length >= 14 },
            { name: 'memory engine accepts status queries', passed: (await memory.getStats()).closed === false },
        ];
    } finally {
        await memory.close();
    }
}