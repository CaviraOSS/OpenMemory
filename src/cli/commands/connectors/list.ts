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
 *  file  : src/cli/commands/connectors/list.ts
 *  usage : implements the LongMemory list component
 */

import { connector_definitions } from '../../../connectors/registry.js';
import { detect_cwd_project } from '../../context/cwd_project.js';
import { load_local_config } from '../../context/config_loader.js';
import type { cli_command } from '../../context/cli_context.js';
import { command_flags } from '../../context/cli_context.js';
import { emit } from '../../output/pretty.js';
import { table } from '../../output/table.js';

export const connectors_list_command: cli_command = async (context) => {
    command_flags(context, []);
    const config = load_local_config(detect_cwd_project(context.cwd).root);
    const configured = new Set(Object.keys(config.connectors ?? {}));
    const connectors = connector_definitions.map((item) => ({ ...item, configured: configured.has(item.id) }));
    emit(context, { ok: true, connectors }, () => table(connectors.map((item) => ({ status: item.configured ? context.colors.success('CONFIGURED') : context.colors.muted(item.status.toUpperCase()), connector: item.name, id: item.id, category: item.category, auth: item.auth })), [{ key: 'status', label: 'STATUS', width: 12 }, { key: 'connector', label: 'CONNECTOR', min: 16 }, { key: 'id', label: 'ID', min: 8 }, { key: 'category', label: 'CATEGORY', width: 12 }, { key: 'auth', label: 'AUTH', width: 10 }], context.colors, context.terminal_width));
};