import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createMemory as create_memory } from '../../core/create_memory.js';
import type { cli_command } from '../context/cli_context.js';
import { command_flags, memory_config } from '../context/cli_context.js';
import { emit } from '../output/pretty.js';
import { panel } from '../output/panel.js';

export const init_command: cli_command = async (context) => {
    command_flags(context, []);
    const next_commands = ['openmemory project init', 'openmemory mcp', 'openmemory agent preflight "your task"'];
    if (!context.dry_run) {
        mkdirSync(dirname(context.db_path), { recursive: true });
        const memory = create_memory(memory_config(context));
        await memory.close();
    }
    const result = { ok: true, project: context.project_id, db_path: context.db_path, dry_run: context.dry_run, next_commands };
    emit(context, result, () => [
        panel('', context.colors, { title: 'OpenMemory initialized', kind: context.dry_run ? 'warning' : 'success', width: context.terminal_width, rows: [
            ['Project', context.project_name], ['ID', context.project_id], ['Database', context.db_path], ['Mode', context.dry_run ? 'dry run' : 'local'],
        ] }),
        '', context.colors.title('Next'), ...next_commands.map((command) => `  ${context.colors.info(command)}`),
    ].join('\n'));
};