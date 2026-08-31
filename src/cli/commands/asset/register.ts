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
 *  file  : src/cli/commands/asset/register.ts
 *  usage : implements the LongMemory register component
 */


import type { memory_asset_input } from '../../../core/project/project_assets.js';
import type { cli_command } from '../../context/cli_context.js';
import { command_flags, flag, list_flag, require_value, with_project } from '../../context/cli_context.js';
import { emit } from '../../output/pretty.js';
import { binding_flags, json_object } from './common.js';

export const asset_register_command: cli_command = async (context) => {
    command_flags(context, ['input-json', 'id', 'type', 'name', 'description', 'owner', 'source-type', 'source-ref', 'content-ref', 'status', 'visibility', 'teams', 'labels', 'agents', 'tasks', 'frameworks', 'mode', 'priority', 'created-by']);
    const structured = json_object<memory_asset_input>(flag(context, 'input-json'), 'input-json');
    const input: memory_asset_input = {
        ...structured,
        asset_id: flag(context, 'id') ?? structured.asset_id,
        type: (flag(context, 'type') ?? structured.type) as memory_asset_input['type'],
        name: require_value(flag(context, 'name') ?? structured.name, 'asset name'),
        description: require_value(flag(context, 'description') ?? structured.description, 'asset description'),
        owner_id: require_value(flag(context, 'owner') ?? structured.owner_id ?? context.user_id, 'asset owner'),
        source_type: require_value(flag(context, 'source-type') ?? structured.source_type, 'asset source type'),
        source_ref: flag(context, 'source-ref') ?? structured.source_ref,
        content_ref: require_value(flag(context, 'content-ref') ?? structured.content_ref, 'asset content ref'),
        status: (flag(context, 'status') ?? structured.status) as memory_asset_input['status'],
        visibility: (flag(context, 'visibility') ?? structured.visibility) as memory_asset_input['visibility'],
        team_ids: list_flag(context, 'teams').length ? list_flag(context, 'teams') : structured.team_ids,
        labels: list_flag(context, 'labels').length ? list_flag(context, 'labels') : structured.labels,
        bindings: binding_flags(context).length ? binding_flags(context) : structured.bindings,
    };
    const asset = await with_project(context, (project) => project.registerAsset(context.project_id, input));
    emit(context, { ok: true, project_id: context.project_id, asset }, () => `Registered ${asset.type} ${asset.name} v${asset.version}`);
};