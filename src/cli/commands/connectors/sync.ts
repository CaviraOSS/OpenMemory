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
 *  file  : src/cli/commands/connectors/sync.ts
 *  usage : implements the LongMemory sync component
 */

import { existsSync } from 'node:fs';
import { createMemory as create_memory } from '../../../core/create_memory.js';
import { project_memory } from '../../../core/project/project_memory.js';
import { default_connector_registry } from '../../../connectors/registry.js';
import { detect_cwd_project } from '../../context/cwd_project.js';
import { load_local_config } from '../../context/config_loader.js';
import type { cli_command } from '../../context/cli_context.js';
import { command_flags, positional, require_value, with_project } from '../../context/cli_context.js';
import { cli_error, exit_codes } from '../../output/errors.js';
import { progress_bar } from '../../output/progress.js';
import { emit } from '../../output/pretty.js';
import { panel } from '../../output/panel.js';
import { table } from '../../output/table.js';

export const connectors_sync_command: cli_command = async (context) => {
    command_flags(context, []);
    const id = require_value(positional(context), 'connector id');
    const config = load_local_config(detect_cwd_project(context.cwd).root).connectors?.[id];
    if (!config) throw new cli_error('connector_not_configured', `Connector is not configured: ${id}`, exit_codes.connector, {}, `longmemory connectors add ${id}`);
    const progress = new progress_bar(context, `Syncing ${id}`, 1); progress.update(0);
    const sync = async (manager: project_memory) => {
        await manager.linkSourceToProject(context.project_id, { connector_id: id, config });
        return manager.syncProjectSource(context.project_id, id, { dry_run: context.dry_run });
    };
    let report;
    if (context.dry_run) {
        if (!existsSync(context.db_path)) throw new cli_error('database_not_found', 'Dry-run requires an initialized project database', exit_codes.database, {}, 'longmemory project init');
        const memory = create_memory({ store: 'sqlite', db_path: context.db_path, user_id: context.user_id, readonly: true });
        const manager = new project_memory({ memory, tenant_id: 'default', project_id: context.project_id, name: context.project_name, connector_registry: default_connector_registry });
        try { await manager.createProject({ tenant_id: 'default', project_id: context.project_id, name: context.project_name }); report = await sync(manager); }
        finally { await manager.close(); await memory.close(); }
    } else report = await with_project(context, sync);
    progress.finish(`${report.discovered} items`);
    const result = { ok: report.failures.length === 0, ...report };
    if (report.failures.length) throw new cli_error('connector_failure', `${report.failures.length} connector items failed`, exit_codes.connector, { failures: report.failures });
    emit(context, result, () => [panel(`${report.dry_run ? 'Plan complete' : 'Sync complete'} for ${id}`, context.colors, { title: report.dry_run ? 'Connector dry run' : 'Connector sync', kind: report.dry_run ? 'warning' : 'success', width: context.terminal_width, rows: [['Discovered', report.discovered], ['Created', report.created], ['Updated', report.updated], ['Skipped', report.unchanged], ['Errors', report.failures.length]] }), '', table(report.failures.map((failure) => ({ item: failure.item_id, attempts: failure.attempts, error: failure.message })), [{ key: 'item', label: 'ITEM', min: 12 }, { key: 'attempts', label: 'TRIES', width: 5 }, { key: 'error', label: 'ERROR', min: 20 }], context.colors, context.terminal_width)].filter(Boolean).join('\n'));
};