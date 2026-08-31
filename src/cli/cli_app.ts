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
 *  file  : src/cli/cli_app.ts
 *  usage : implements the LongMemory cli app component
 */


import { create_cli_context, default_io, type cli_command, type cli_io } from './context/cli_context.js';
import { parse_argv } from './context/config_loader.js';
import { render_error, cli_error, exit_codes } from './output/errors.js';
import { banner, emit } from './output/pretty.js';
import { panel } from './output/panel.js';
import package_json from '../../package.json' with { type: 'json' };

type cli_command_loader = () => Promise<cli_command>;

const commands = new Map<string, cli_command_loader>([
    ['init', async () => (await import('./commands/init.js')).init_command],
    ['status', async () => (await import('./commands/status.js')).status_command],
    ['doctor', async () => (await import('./commands/doctor.js')).doctor_command],
    ['serve', async () => (await import('./commands/serve.js')).serve_command],
    ['mcp', async () => (await import('./commands/mcp.js')).mcp_command],
    ['ingest', async () => (await import('./commands/ingest.js')).ingest_command],
    ['recall', async () => (await import('./commands/recall.js')).recall_command],
    ['explain', async () => (await import('./commands/explain.js')).explain_command],
    ['timeline', async () => (await import('./commands/timeline.js')).timeline_command],
    ['memory:list', async () => (await import('./commands/memory/list.js')).memory_list_command],
    ['maintenance:decay', async () => (await import('./commands/maintenance/decay.js')).maintenance_decay_command],
    ['maintenance:reinforce', async () => (await import('./commands/maintenance/reinforce.js')).maintenance_reinforce_command],
    ['bench', async () => (await import('./commands/bench.js')).bench_command],
    ['project:init', async () => (await import('./commands/project/init.js')).project_init_command],
    ['project:context', async () => (await import('./commands/project/context.js')).project_context_command],
    ['project:handoff', async () => (await import('./commands/project/handoff.js')).project_handoff_command],
    ['project:decisions', async () => (await import('./commands/project/decisions.js')).project_decisions_command],
    ['project:tasks', async () => (await import('./commands/project/tasks.js')).project_tasks_command],
    ['project:conflicts', async () => (await import('./commands/project/conflicts.js')).project_conflicts_command],
    ['skill:create', async () => (await import('./commands/skill/create.js')).skill_create_command],
    ['skill:list', async () => (await import('./commands/skill/list.js')).skill_list_command],
    ['skill:match', async () => (await import('./commands/skill/match.js')).skill_match_command],
    ['skill:bind', async () => (await import('./commands/skill/bind.js')).skill_bind_command],
    ['skill:archive', async () => (await import('./commands/skill/archive.js')).skill_archive_command],
    ['code:search', async () => (await import('./commands/code/search.js')).code_search_command],
    ['code:callers', async () => (await import('./commands/code/callers.js')).code_callers_command],
    ['code:callees', async () => (await import('./commands/code/callees.js')).code_callees_command],
    ['code:impact', async () => (await import('./commands/code/impact.js')).code_impact_command],
    ['session:import', async () => (await import('./commands/session/import.js')).session_import_command],
    ['session:list', async () => (await import('./commands/session/list.js')).session_list_command],
    ['session:discover', async () => (await import('./commands/session/discover.js')).session_discover_command],
    ['session:wiki', async () => (await import('./commands/session/wiki.js')).session_wiki_command],
    ['asset:register', async () => (await import('./commands/asset/register.js')).asset_register_command],
    ['asset:govern', async () => (await import('./commands/asset/govern.js')).asset_govern_command],
    ['asset:list', async () => (await import('./commands/asset/list.js')).asset_list_command],
    ['asset:loadout', async () => (await import('./commands/asset/loadout.js')).asset_loadout_command],
    ['connectors:list', async () => (await import('./commands/connectors/list.js')).connectors_list_command],
    ['connectors:add', async () => (await import('./commands/connectors/add.js')).connectors_add_command],
    ['connectors:sync', async () => (await import('./commands/connectors/sync.js')).connectors_sync_command],
    ['connectors:status', async () => (await import('./commands/connectors/status.js')).connectors_status_command],
    ['agent:preflight', async () => (await import('./commands/agent/preflight.js')).agent_preflight_command],
    ['agent:context', async () => (await import('./commands/agent/context.js')).agent_context_command],
    ['agent:after-run', async () => (await import('./commands/agent/after_run.js')).agent_after_run_command],
    ['agent:remember-failure', async () => (await import('./commands/agent/remember_failure.js')).agent_remember_failure_command],
    ['agent:manifest', async () => (await import('./commands/agent/manifest.js')).agent_manifest_command],
    ['detect', async () => (await import('./commands/porter/detect.js')).detect_command],
    ['port', async () => (await import('./commands/porter/port.js')).port_command],
    ['verify', async () => (await import('./commands/porter/verify.js')).verify_command],
    ['tui', async () => (await import('./commands/porter/tui.js')).tui_command],
]);

const help = {
    ok: true,
    name: 'longmemory',
    subtitle: 'Hydrograph memory for agents',
    usage: 'longmemory <command> [arguments] [flags]',
    global_flags: ['--db <path>', '--project <id>', '--user <id>', '--json', '--jsonl', '--pretty', '--compact', '--no-color', '--silent', '--interactive', '--dry-run', '--token-budget <number>', '--cwd <path>'],
    commands: [
        'status', 'init', 'doctor', 'serve [--host <host>] [--port <port>] [--mcp-http]', 'mcp [--read-only]',
        'ingest "memory" [--stdin] [--type <type>] [--source <source>]', 'recall "query" [--mode <mode>]', 'explain <memory-id>',
        'timeline <entity|project|memory>', 'memory list [--limit <n>] [--status <status>]',
        'maintenance decay [--limit <n>] [--all]', 'maintenance reinforce <memory-id>',
        'bench', 'project <init|context|handoff|decisions|tasks|conflicts>',
        'skill <create|list|match|bind|archive>',
        'code <search|callers|callees|impact>',
        'session <import|list|discover|wiki>',
        'asset <register|govern|list|loadout>',
        'connectors <list|add|sync|status>', 'agent <preflight|context|after-run|remember-failure|manifest>',
        'detect', 'port --from <harness> --to longmemory (--all | --id <id>...) [--force] [--jsonl]',
        'session wiki --from <harness> (--all | --id <id>...) [--name <name>] [--agent <id>]',
        'verify --from <harness> [--sample <n>]', 'tui',
    ],
};

const human_help = (context: ReturnType<typeof create_cli_context>) => [
    banner(context), '', panel('Fast local memory for coding agents and terminal-first developers.', context.colors, { title: 'longmemory', kind: 'info', width: context.terminal_width }), '',
    context.colors.title('Usage'), '  longmemory <command> [arguments] [flags]', '', context.colors.title('Start here'),
    '  longmemory tui', '  longmemory detect', '  longmemory project context "your task"', '  longmemory agent preflight "your task" --json', '',
    context.colors.title('Commands'), ...help.commands.map((command) => `  ${context.colors.info(command)}`), '',
    context.colors.muted('Run with --json for stable machine output. Interactive prompts are opt-in only.'),
].join('\n');

export const resolve_cli_argv = (argv: string[], terminal: boolean): string[] => argv.length === 0 && terminal ? ['tui'] : argv;

export async function run_cli_app(argv = process.argv.slice(2), env: NodeJS.ProcessEnv = process.env, io: cli_io = default_io()): Promise<number> {
    let context: ReturnType<typeof create_cli_context> | null = null;
    try {
        const args = parse_argv(resolve_cli_argv(argv, io.terminal ?? Boolean(process.stdout.isTTY)));
        context = create_cli_context(args, env, io);
        if (args.command === 'version' || args.flags.has('version')) {
            emit(context, { ok: true, name: package_json.name, version: package_json.version }, () => `longmemory ${package_json.version}`);
            return context.exit_code;
        }
        if (args.command === 'help' || args.flags.has('help')) {
            emit(context, help, () => human_help(context!));
            return context.exit_code;
        }
        const load_command = commands.get(args.command);
        if (!load_command) throw new cli_error('unknown_command', `Unknown command: ${args.command}`, exit_codes.validation, { commands: [...commands.keys()] }, 'longmemory help', 'Choose a registered command.');
        if (context.human && !context.silent && args.command !== 'mcp' && args.command !== 'tui') io.stdout(banner(context));
        const command = await load_command();
        await command(context);
        return context.exit_code;
    } catch (error) {
        const value = !context && error instanceof Error
            ? new cli_error('validation_error', error.message, exit_codes.validation, {}, 'longmemory help', 'Correct the command arguments.')
            : error;
        return render_error(context, io, value);
    }
}

export const registered_commands = () => [...commands.keys()];
export const register_cli_command = (name: string, command: cli_command) => commands.set(name, async () => command);