import type { cli_command } from '../../context/cli_context.js';
import { command_flags, has, with_project } from '../../context/cli_context.js';
import { emit } from '../../output/pretty.js';

export const asset_list_command: cli_command = async (context) => {
    command_flags(context, ['all']);
    const assets = await with_project(context, (project) => project.listAssets(context.project_id, has(context, 'all')));
    emit(context, { ok: true, project_id: context.project_id, count: assets.length, assets }, () => assets.length
        ? assets.map((asset) => `${asset.type} · ${asset.status} · ${asset.name} v${asset.version} · ${asset.asset_id}`).join('\n') : 'No memory assets.');
};