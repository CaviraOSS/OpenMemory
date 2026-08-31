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
 *  file  : src/cli/commands/status.ts
 *  usage : implements the LongMemory status component
 */


import { connector_definitions } from '../../connectors/registry.js';
import type { cli_command } from '../context/cli_context.js';
import { command_flags, number_flag, with_read_memory } from '../context/cli_context.js';
import { detect_cwd_project } from '../context/cwd_project.js';
import { load_local_config } from '../context/config_loader.js';
import { badge } from '../theme/badges.js';
import { icons } from '../theme/icons.js';
import { emit, section } from '../output/pretty.js';
import { panel } from '../output/panel.js';
import { cli_error, exit_codes } from '../output/errors.js';
import { memory_summary } from './memory/summary.js';
import { resolve_project_scope } from '../context/project_scope.js';

export const status_command: cli_command = async (context) => {
    command_flags(context, ['memories']);
    const memory_limit = number_flag(context, 'memories', 0) as number;
    if (!Number.isInteger(memory_limit) || memory_limit < 0 || memory_limit > 200) throw new cli_error('validation_error', '--memories must be an integer between 0 and 200', exit_codes.validation);
    const result = await with_read_memory(context, async (memory) => {
        const stats = await memory.getStats();
        const scope = await resolve_project_scope(memory, context.project_id);
        const historical = await memory.recall({ text: '', mode: 'historical', world_id: scope.root?.id, token_budget: 512, permission_context: { user_id: context.user_id, project_ids: [context.project_id] } });
        const entries = 'timeline' in historical ? historical.timeline.entries : [];
        const scoped_worlds = scope.legacy ? (await memory.listWorlds()).length : scope.world_ids.size;
        const configured = Object.keys(load_local_config(detect_cwd_project(context.cwd).root).connectors ?? {}).length;
        const decisions = entries.filter((entry) => entry.node.metadata.project_event_kind === 'decision' && entry.node.state.status === 'active').length;
        const conflict_ids = new Set(entries.flatMap((entry) => entry.node.state.status === 'contradicted' ? [entry.node.id] : []));
        return {
            ok: true, project: { id: context.project_id, name: context.project_name, initialized: scope.initialized }, db_path: context.db_path,
            server: { status: 'offline', configured: true }, mcp: { status: 'ready' }, connectors: { available: connector_definitions.length, configured },
            memory: { ...stats, nodes: entries.length, worlds: scoped_worlds, active: entries.filter((entry) => entry.node.state.status === 'active').length, grounded: entries.filter((entry) => entry.node.grounding.worlddb_ref).length, superseded: entries.filter((entry) => entry.node.temporal.superseded_at !== null).length },
            recent_memories: entries.map((entry) => entry.node)
                .sort((left, right) => right.temporal.observed_at - left.temporal.observed_at || left.id.localeCompare(right.id))
                .slice(0, memory_limit)
                .map(memory_summary),
            active_decisions: decisions, unresolved_conflicts: conflict_ids.size, last_sync: null, benchmark_health: 'not_run',
        };
    });
    emit(context, result, () => {
        const memory = result.memory;
        return [
            panel('', context.colors, {
                title: 'LongMemory Hydrograph', kind: 'info', width: context.terminal_width, rows: [
                    ['Project', `${result.project.name}${result.project.initialized ? '' : ' (not initialized)'}`], ['Database', result.db_path],
                    ['Mode', 'local'], ['MCP', badge('ACTIVE', true, context.colors)], ['Server', context.colors.muted('offline')],
                ]
            }), '',
            section(context, `${icons.memory} Memory`, [
                `${badge('ACTIVE', true, context.colors)}        ${memory.active}`,
                `${badge('GROUNDED', true, context.colors)}      ${memory.grounded}`,
                `${badge('SUPERSEDED', true, context.colors)}  ${memory.superseded}`,
                `${context.colors.danger('[CONFLICTS]')}     ${result.unresolved_conflicts}`,
            ].join('\n')), '',
            section(context, 'Project Health', [
                `${icons.success} strict recall gates enabled`, `${icons.success} ${memory.worlds} worlds loaded`,
                result.unresolved_conflicts ? `${context.colors.warning(icons.warning)} ${result.unresolved_conflicts} unresolved conflicts` : `${icons.success} no unresolved conflicts`,
                `${context.colors.muted('○')} benchmark not run in this session`,
            ].join('\n')), '',
            section(context, 'Next', `${context.colors.info('longmemory agent preflight "your task"')}\n${context.colors.info('longmemory project conflicts')}`),
        ].join('\n');
    });
};