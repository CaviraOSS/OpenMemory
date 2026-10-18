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
 *  file  : src/cli/commands/migrate.ts
 *  usage : implements the LongMemory legacy migration command
 */


import type { memory_config as longmemory_config } from '../../core/create_memory.js';
import { migrate_legacy } from '../../core/migration/legacy_mapper.js';
import { write_migration_report } from '../../core/migration/migration_report.js';
import type { cli_command } from '../context/cli_context.js';
import { command_flags, flag, memory_config, require_value } from '../context/cli_context.js';
import { emit } from '../output/pretty.js';
import { panel } from '../output/panel.js';

export const migrate_command: cli_command = async (context) => {
    command_flags(context, ['from', 'to', 'report']);
    const from = require_value(flag(context, 'from'), '--from');
    const to = require_value(flag(context, 'to'), '--to');
    const configured = memory_config(context);
    const migration_config: Omit<longmemory_config, 'store' | 'db_path' | 'readonly'> = {};
    if (configured.embedding_provider) migration_config.embedding_provider = configured.embedding_provider;
    if (configured.embedding_dimension !== undefined) migration_config.embedding_dimension = configured.embedding_dimension;
    if (configured.multilingual_embedding_provider) migration_config.multilingual_embedding_provider = configured.multilingual_embedding_provider;
    const report = await migrate_legacy({ from, to, memory_config: migration_config });
    const report_path = write_migration_report(report, flag(context, 'report') ?? `${to}.migration-report.json`);
    const result = { ok: report.benchmark_result.passed && report.errors.length === 0, report_path, ...report };
    emit(context, result, () => panel('', context.colors, {
        title: 'Legacy migration', kind: result.ok ? 'success' : 'warning', width: context.terminal_width, rows: [
            ['Source', report.source_path], ['Destination', report.destination_path], ['Imported nodes', report.imported_nodes],
            ['Imported edges', report.imported_edges], ['Skipped records', report.skipped_records.length],
            ['Errors', report.errors.length], ['Integrity benchmark', report.benchmark_result.passed], ['Report', report_path],
        ],
    }));
};
