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
 *  file  : src/cli/commands/asset/loadout.ts
 *  usage : implements the LongMemory loadout component
 */

import type { cli_command } from '../../context/cli_context.js';
import { command_flags, flag, positional, require_value, with_project } from '../../context/cli_context.js';
import { emit } from '../../output/pretty.js';
import { loadout_flags } from './common.js';

export const asset_loadout_command: cli_command = async (context) => {
    command_flags(context, ['query', 'subject-user', 'teams', 'roles', 'agent', 'task', 'framework', 'include-unbound', 'types']);
    const query = require_value(positional(context) ?? flag(context, 'query'), 'loadout query');
    const loadout = await with_project(context, (project) => project.resolveAssetLoadout(context.project_id, loadout_flags(context, query)));
    emit(context, { ok: true, ...loadout }, () => loadout.selected.length
        ? loadout.selected.map((item) => `${item.asset.type} · ${item.asset.name} · ${item.binding?.injection_mode ?? 'reference'} · ${item.score.toFixed(3)}`).join('\n') : 'No governed assets selected.');
};