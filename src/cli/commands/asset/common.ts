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
 *  file  : src/cli/commands/asset/common.ts
 *  usage : implements the LongMemory common component
 */

import type { memory_asset_binding, memory_asset_input, memory_asset_loadout_input } from '../../../core/project/project_assets.js';
import type { cli_context } from '../../context/cli_context.js';
import { flag, list_flag } from '../../context/cli_context.js';

export const json_object = <T extends Record<string, unknown>>(raw: string | undefined, name: string): Partial<T> => {
    if (!raw) return {};
    try {
        const value = JSON.parse(raw) as unknown;
        if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('expected a JSON object');
        return value as Partial<T>;
    } catch (error) { throw new Error(`--${name} must be a JSON object: ${error instanceof Error ? error.message : String(error)}`); }
};

export const binding_flags = (context: cli_context): memory_asset_binding[] => {
    const mode = (flag(context, 'mode') ?? 'reference') as memory_asset_binding['injection_mode'];
    const priority = Number(flag(context, 'priority') ?? 0.5);
    const created_by = flag(context, 'created-by') ?? context.user_id;
    const values: memory_asset_binding[] = [];
    for (const target_id of list_flag(context, 'agents')) values.push({ target_type: 'agent', target_id, injection_mode: mode, priority, required: false, enabled: true, created_by });
    for (const target_id of list_flag(context, 'tasks')) values.push({ target_type: 'task', target_id, injection_mode: mode, priority, required: false, enabled: true, created_by });
    for (const target_id of list_flag(context, 'frameworks')) values.push({ target_type: 'framework', target_id, injection_mode: mode, priority, required: false, enabled: true, created_by });
    return values;
};

export const loadout_flags = (context: cli_context, query: string): memory_asset_loadout_input => ({
    query, user_id: flag(context, 'subject-user') ?? context.user_id, team_ids: list_flag(context, 'teams'), roles: list_flag(context, 'roles'),
    agent_id: flag(context, 'agent'), task_id: flag(context, 'task'), framework: flag(context, 'framework'),
    include_unbound: flag(context, 'include-unbound') === 'true', token_budget: context.token_budget,
    asset_types: list_flag(context, 'types') as memory_asset_input['type'][],
});