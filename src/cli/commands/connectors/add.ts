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
 *  file  : src/cli/commands/connectors/add.ts
 *  usage : implements the LongMemory add component
 */

import { connector_definitions, default_connector_registry } from '../../../connectors/registry.js';
import { detect_cwd_project } from '../../context/cwd_project.js';
import { load_local_config, save_local_config } from '../../context/config_loader.js';
import type { cli_command } from '../../context/cli_context.js';
import { command_flags, flag, positional, require_value } from '../../context/cli_context.js';
import { cli_error, exit_codes } from '../../output/errors.js';
import { emit } from '../../output/pretty.js';
import { panel } from '../../output/panel.js';

export const connectors_add_command: cli_command = async (context) => {
    command_flags(context, ['config', 'set']);
    const id = require_value(positional(context), 'connector id');
    if (!default_connector_registry.has(id)) throw new cli_error('connector_not_found', `Unknown connector: ${id}`, exit_codes.validation, {}, 'longmemory connectors list');
    let connector_config: Record<string, unknown> = {};
    const raw = flag(context, 'config');
    if (raw) {
        try { connector_config = JSON.parse(raw) as Record<string, unknown>; }
        catch { throw new cli_error('validation_error', '--config must contain valid JSON', exit_codes.validation); }
    }
    const sets = context.args.flags.get('set');
    for (const value of Array.isArray(sets) ? sets : sets ? [String(sets)] : []) {
        const split = value.indexOf('=');
        if (split < 1) throw new cli_error('validation_error', '--set requires key=value', exit_codes.validation);
        connector_config[value.slice(0, split)] = value.slice(split + 1);
    }
    const definition = connector_definitions.find((item) => item.id === id)!;
    const missing = definition.required_config.filter((key) => connector_config[key] === undefined);
    if (missing.length) throw new cli_error('validation_error', `Missing connector config: ${missing.join(', ')}`, exit_codes.validation, { required: definition.required_config }, `longmemory connectors add ${id} --set ${missing[0]}=value`);
    const root = detect_cwd_project(context.cwd).root;
    const local = load_local_config(root);
    const next = { ...local, connectors: { ...(local.connectors ?? {}), [id]: connector_config } };
    const path = context.dry_run ? null : save_local_config(root, next);
    const result = { ok: true, connector_id: id, connector: definition.name, config: connector_config, config_path: path, dry_run: context.dry_run };
    emit(context, result, () => panel(context.dry_run ? 'Configuration validated; nothing written.' : 'Connector configuration saved.', context.colors, { title: definition.name, kind: context.dry_run ? 'warning' : 'success', width: context.terminal_width, rows: [['ID', id], ['Config', path ?? 'dry run'], ['Required fields', definition.required_config.join(', ') || 'none']] }));
};