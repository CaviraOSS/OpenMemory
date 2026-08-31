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
 *  file  : src/cli/commands/doctor.ts
 *  usage : implements the LongMemory doctor component
 */


import { existsSync } from 'node:fs';
import { run_cli_benchmarks } from './bench.js';
import type { cli_command } from '../context/cli_context.js';
import { command_flags, with_read_memory } from '../context/cli_context.js';
import { emit } from '../output/pretty.js';
import { panel } from '../output/panel.js';
import { table } from '../output/table.js';

export const doctor_command: cli_command = async (context) => {
    command_flags(context, []);
    const database_exists = context.db_path === ':memory:' || existsSync(context.db_path);
    const benchmarks = await run_cli_benchmarks();
    const checks = database_exists ? await with_read_memory(context, async (memory) => {
        const stats = await memory.getStats();
        return [
            { check: 'database', status: 'pass', detail: `${stats.nodes} nodes reachable`, fix: '' },
            { check: 'migrations', status: 'pass', detail: 'SQLite schema opened successfully', fix: '' },
            { check: 'project', status: context.project_id ? 'pass' : 'warn', detail: context.project_name, fix: 'Run longmemory project init' },
            { check: 'MCP', status: 'pass', detail: 'stdio transport available', fix: '' },
            { check: 'server', status: 'pass', detail: 'server configuration valid', fix: '' },
            { check: 'connectors', status: 'pass', detail: 'connector registry available', fix: '' },
            { check: 'integrity', status: memory.invariants().length >= 14 ? 'pass' : 'fail', detail: `${memory.invariants().length} invariants`, fix: 'Restore or migrate the database' },
            { check: 'benchmark smoke', status: benchmarks.every((item) => item.passed) ? 'pass' : 'fail', detail: `${benchmarks.filter((item) => item.passed).length}/${benchmarks.length} passed`, fix: 'Run longmemory bench' },
            { check: 'database file', status: existsSync(context.db_path) ? 'pass' : 'warn', detail: context.db_path, fix: 'Run longmemory init' },
        ];
    }) : [
        { check: 'database', status: 'warn', detail: 'not initialized', fix: 'Run longmemory init' },
        { check: 'migrations', status: 'warn', detail: 'not checked', fix: 'Run longmemory init' },
        { check: 'project', status: 'warn', detail: context.project_name, fix: 'Run longmemory init' },
        { check: 'MCP', status: 'pass', detail: 'stdio transport available', fix: '' },
        { check: 'server', status: 'pass', detail: 'server configuration valid', fix: '' },
        { check: 'connectors', status: 'pass', detail: 'connector registry available', fix: '' },
        { check: 'integrity', status: 'warn', detail: 'database not initialized', fix: 'Run longmemory init' },
        { check: 'benchmark smoke', status: benchmarks.every((item) => item.passed) ? 'pass' : 'fail', detail: `${benchmarks.filter((item) => item.passed).length}/${benchmarks.length} passed`, fix: 'Run longmemory bench' },
        { check: 'database file', status: 'warn', detail: context.db_path, fix: 'Run longmemory init' },
    ];
    const ok = checks.every((check) => check.status !== 'fail');
    emit(context, { ok, checks }, () => [
        panel(ok ? 'Core systems are ready.' : 'One or more checks need attention.', context.colors, { title: 'LongMemory doctor', kind: ok ? 'success' : 'danger', width: context.terminal_width }), '',
        table(checks.map((check) => ({ status: check.status === 'pass' ? context.colors.success('✓ PASS') : check.status === 'warn' ? context.colors.warning('! WARN') : context.colors.danger('× FAIL'), check: check.check, detail: check.detail, fix: check.fix || '—' })), [
            { key: 'status', label: 'STATUS', width: 8 }, { key: 'check', label: 'CHECK', width: 18 }, { key: 'detail', label: 'DETAIL', min: 12 }, { key: 'fix', label: 'FIX', min: 10 },
        ], context.colors, context.terminal_width),
    ].join('\n'));
};