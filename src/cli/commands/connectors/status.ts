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
 *  file  : src/cli/commands/connectors/status.ts
 *  usage : implements the LongMemory status component
 */

import { default_connector_registry } from '../../../connectors/registry.js';
import { detect_cwd_project } from '../../context/cwd_project.js';
import { load_local_config } from '../../context/config_loader.js';
import type { cli_command } from '../../context/cli_context.js';
import { command_flags } from '../../context/cli_context.js';
import { empty_state } from '../../output/empty_state.js';
import { emit } from '../../output/pretty.js';
import { table } from '../../output/table.js';

export const connectors_status_command: cli_command = async (context) => {
    command_flags(context, []);
    const configured = load_local_config(detect_cwd_project(context.cwd).root).connectors ?? {};
    const statuses = await Promise.all(Object.entries(configured).map(async ([id, config]) => {
        try { const connector = default_connector_registry.load(id, config); await connector.connect(config); return { id, healthy: await connector.testConnection(), message: 'connected' }; }
        catch (error) { return { id, healthy: false, message: error instanceof Error ? error.message : String(error) }; }
    }));
    emit(context, { ok: statuses.every((item) => item.healthy), connectors: statuses }, () => statuses.length ? table(statuses.map((item) => ({ status: item.healthy ? context.colors.success('HEALTHY') : context.colors.danger('FAILED'), connector: item.id, detail: item.message })), [{ key: 'status', label: 'STATUS', width: 9 }, { key: 'connector', label: 'CONNECTOR', width: 16 }, { key: 'detail', label: 'DETAIL', min: 20 }], context.colors, context.terminal_width) : empty_state('connectors', context.colors, context.terminal_width));
};