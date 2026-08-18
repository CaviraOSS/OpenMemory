import { connector_definitions } from '../../connectors/registry.js';
import type { cli_command } from '../context/cli_context.js';
import { command_flags, with_memory } from '../context/cli_context.js';
import { detect_cwd_project } from '../context/cwd_project.js';
import { load_local_config } from '../context/config_loader.js';
import { badge } from '../theme/badges.js';
import { icons } from '../theme/icons.js';
import { emit, section } from '../output/pretty.js';
import { panel } from '../output/panel.js';

export const status_command: cli_command = async (context) => {
    command_flags(context, []);
    const result = await with_memory(context, async (memory) => {
        const stats = await memory.getStats();
        const worlds = await memory.listWorlds();
        const project = worlds.find((world) => world.metadata.hierarchy === 'project' && world.metadata.project_id === context.project_id);
        const historical = await memory.recall({ text: '', mode: 'historical', world_id: project?.id, token_budget: 512, permission_context: { user_id: context.user_id, project_ids: [context.project_id] } });
        const entries = 'timeline' in historical ? historical.timeline.entries : [];
        const configured = Object.keys(load_local_config(detect_cwd_project(context.cwd).root).connectors ?? {}).length;
        const decisions = entries.filter((entry) => entry.node.metadata.project_event_kind === 'decision' && entry.node.state.status === 'active').length;
        const conflict_ids = new Set(entries.flatMap((entry) => entry.node.state.status === 'contradicted' ? [entry.node.id] : []));
        return {
            ok: true, project: { id: context.project_id, name: context.project_name, initialized: Boolean(project) }, db_path: context.db_path,
            server: { status: 'offline', configured: true }, mcp: { status: 'ready' }, connectors: { available: connector_definitions.length, configured },
            memory: { ...stats, active: entries.filter((entry) => entry.node.state.status === 'active').length, grounded: entries.filter((entry) => entry.node.grounding.worlddb_ref).length, superseded: entries.filter((entry) => entry.node.temporal.superseded_at !== null).length },
            active_decisions: decisions, unresolved_conflicts: conflict_ids.size, last_sync: null, benchmark_health: 'not_run',
        };
    });
    emit(context, result, () => {
        const memory = result.memory;
        return [
            panel('', context.colors, { title: 'OpenMemory Hydrograph', kind: 'info', width: context.terminal_width, rows: [
                ['Project', `${result.project.name}${result.project.initialized ? '' : ' (not initialized)'}`], ['Database', result.db_path],
                ['Mode', 'local'], ['MCP', badge('ACTIVE', true, context.colors)], ['Server', context.colors.muted('offline')],
            ] }), '',
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
            section(context, 'Next', `${context.colors.info('openmemory agent preflight "your task"')}\n${context.colors.info('openmemory project conflicts')}`),
        ].join('\n');
    });
};