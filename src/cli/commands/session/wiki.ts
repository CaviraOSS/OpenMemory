import type { memory_asset_status } from '../../../core/project/project_assets.js';
import type { cli_command } from '../../context/cli_context.js';
import { command_flags, flag, flags, has, with_project } from '../../context/cli_context.js';
import { emit } from '../../output/pretty.js';
import { panel } from '../../output/panel.js';
import { sessions_to_wiki } from '../../porter/wiki.js';
import { parse_harness } from '../porter/common.js';

const statuses: memory_asset_status[] = ['draft', 'candidate', 'approved'];

export const session_wiki_command: cli_command = async (context) => {
    command_flags(context, ['from', 'id', 'all', 'name', 'owner', 'agent', 'status']);
    const harness = parse_harness(flag(context, 'from'));
    const ids = flags(context, 'id').filter(Boolean);
    const all = has(context, 'all');
    if (!all && !ids.length) throw new Error('one of --all or --id <session-id> is required');
    const status = (flag(context, 'status') ?? 'candidate') as memory_asset_status;
    if (!statuses.includes(status)) throw new Error(`--status must be one of ${statuses.join(', ')}`);
    const result = await with_project(context, (project) => sessions_to_wiki(project, context.project_id, harness, {
        all, ids, name: flag(context, 'name'), owner_id: flag(context, 'owner') ?? context.user_id,
        agent_id: flag(context, 'agent'), status, env: context.env,
    }));
    emit(context, { ok: true, project_id: context.project_id, harness, ...result }, () => panel(`Converted ${result.sessions} conversation${result.sessions === 1 ? '' : 's'} and ${result.turns} turns.`, context.colors, {
        title: `AI Wiki ${result.status}`, kind: result.status === 'skipped' ? 'muted' : 'success', width: context.terminal_width,
        rows: [['asset', result.asset.asset_id], ['name', result.asset.name], ['version', result.asset.version], ['status', result.asset.status], ['visibility', result.asset.visibility]],
    }));
};