import type { memory_asset_input } from '../../../core/project/project_assets.js';
import type { cli_command } from '../../context/cli_context.js';
import { command_flags, flag, list_flag, positional, require_value, with_project } from '../../context/cli_context.js';
import { emit } from '../../output/pretty.js';
import { binding_flags, json_object } from './common.js';

export const asset_govern_command: cli_command = async (context) => {
    command_flags(context, ['patch-json', 'status', 'visibility', 'teams', 'labels', 'agents', 'tasks', 'frameworks', 'mode', 'priority', 'created-by']);
    const asset_id = require_value(positional(context), 'asset id');
    const structured = json_object<memory_asset_input>(flag(context, 'patch-json'), 'patch-json');
    const patch = {
        ...structured,
        status: (flag(context, 'status') ?? structured.status) as memory_asset_input['status'],
        visibility: (flag(context, 'visibility') ?? structured.visibility) as memory_asset_input['visibility'],
        team_ids: list_flag(context, 'teams').length ? list_flag(context, 'teams') : structured.team_ids,
        labels: list_flag(context, 'labels').length ? list_flag(context, 'labels') : structured.labels,
        bindings: binding_flags(context).length ? binding_flags(context) : structured.bindings,
    };
    const asset = await with_project(context, (project) => project.governAsset(context.project_id, asset_id, patch));
    emit(context, { ok: true, project_id: context.project_id, asset }, () => `Governed ${asset.name} v${asset.version} · ${asset.status}`);
};