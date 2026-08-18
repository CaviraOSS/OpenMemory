import { create_cli_context, default_io, type cli_command, type cli_io } from './context/cli_context.js';
import { parse_argv } from './context/config_loader.js';
import { render_error, cli_error, exit_codes } from './output/errors.js';
import { banner, emit } from './output/pretty.js';
import { panel } from './output/panel.js';

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
    ['bench', async () => (await import('./commands/bench.js')).bench_command],
    ['project:init', async () => (await import('./commands/project/init.js')).project_init_command],
    ['project:context', async () => (await import('./commands/project/context.js')).project_context_command],
    ['project:handoff', async () => (await import('./commands/project/handoff.js')).project_handoff_command],
    ['project:decisions', async () => (await import('./commands/project/decisions.js')).project_decisions_command],
    ['project:tasks', async () => (await import('./commands/project/tasks.js')).project_tasks_command],
    ['project:conflicts', async () => (await import('./commands/project/conflicts.js')).project_conflicts_command],
    ['connectors:list', async () => (await import('./commands/connectors/list.js')).connectors_list_command],
    ['connectors:add', async () => (await import('./commands/connectors/add.js')).connectors_add_command],
    ['connectors:sync', async () => (await import('./commands/connectors/sync.js')).connectors_sync_command],
    ['connectors:status', async () => (await import('./commands/connectors/status.js')).connectors_status_command],
    ['agent:preflight', async () => (await import('./commands/agent/preflight.js')).agent_preflight_command],
    ['agent:context', async () => (await import('./commands/agent/context.js')).agent_context_command],
    ['agent:after-run', async () => (await import('./commands/agent/after_run.js')).agent_after_run_command],
    ['agent:remember-failure', async () => (await import('./commands/agent/remember_failure.js')).agent_remember_failure_command],
]);

const help = {
    ok: true,
    name: 'openmemory',
    subtitle: 'Hydrograph memory for agents',
    usage: 'openmemory <command> [arguments] [flags]',
    global_flags: ['--db <path>', '--project <id>', '--user <id>', '--json', '--pretty', '--compact', '--no-color', '--silent', '--interactive', '--dry-run', '--token-budget <number>', '--cwd <path>'],
    commands: [
        'status', 'init', 'doctor', 'serve [--host <host>] [--port <port>] [--mcp-http]', 'mcp [--read-only]',
        'ingest "memory" [--type <type>] [--source <source>]', 'recall "query" [--mode <mode>]', 'explain <memory-id>',
        'timeline <entity|project|memory>', 'bench', 'project <init|context|handoff|decisions|tasks|conflicts>',
        'connectors <list|add|sync|status>', 'agent <preflight|context|after-run|remember-failure>',
    ],
};

const human_help = (context: ReturnType<typeof create_cli_context>) => [
    banner(context), '', panel('Fast local memory for coding agents and terminal-first developers.', context.colors, { title: 'openmemory', kind: 'info', width: context.terminal_width }), '',
    context.colors.title('Usage'), '  openmemory <command> [arguments] [flags]', '', context.colors.title('Start here'),
    '  openmemory status', '  openmemory project context "your task"', '  openmemory agent preflight "your task" --json', '',
    context.colors.title('Commands'), ...help.commands.map((command) => `  ${context.colors.info(command)}`), '',
    context.colors.muted('Run with --json for stable machine output. Interactive prompts are opt-in only.'),
].join('\n');

export async function run_cli_app(argv = process.argv.slice(2), env: NodeJS.ProcessEnv = process.env, io: cli_io = default_io()): Promise<number> {
    let context: ReturnType<typeof create_cli_context> | null = null;
    try {
        const args = parse_argv(argv);
        context = create_cli_context(args, env, io);
        if (args.command === 'help' || args.flags.has('help')) {
            emit(context, help, () => human_help(context!));
            return context.exit_code;
        }
        const load_command = commands.get(args.command);
        if (!load_command) throw new cli_error('unknown_command', `Unknown command: ${args.command}`, exit_codes.validation, { commands: [...commands.keys()] }, 'openmemory help', 'Choose a registered command.');
        if (context.human && !context.silent && args.command !== 'mcp') io.stdout(banner(context));
        const command = await load_command();
        await command(context);
        return context.exit_code;
    } catch (error) {
        const value = !context && error instanceof Error
            ? new cli_error('validation_error', error.message, exit_codes.validation, {}, 'openmemory help', 'Correct the command arguments.')
            : error;
        return render_error(context, io, value);
    }
}

export const registered_commands = () => [...commands.keys()];
export const register_cli_command = (name: string, command: cli_command) => commands.set(name, async () => command);