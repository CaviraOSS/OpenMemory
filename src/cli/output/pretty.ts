import type { cli_context } from '../context/cli_context.js';
import { render_json } from './json.js';

export const openmemory_art = [
    '  ___  ____  _____ _   _ __  __ _____ __  __  ___  ______   __',
    ' / _ \\|  _ \\| ____| \\ | |  \\/  | ____|  \\/  |/ _ \\|  _ \\ \\ / /',
    '| | | | |_) |  _| |  \\| | |\\/| |  _| | |\\/| | | | | |_) |\\ V /',
    '| |_| |  __/| |___| |\\  | |  | | |___| |  | | |_| |  _ <  | |',
    ' \\___/|_|   |_____|_| \\_|_|  |_|_____|_|  |_|\\___/|_| \\_\\ |_|',
];

export function banner(context: cli_context): string {
    const art = openmemory_art.map((line, index) => index < 2 ? context.colors.info(line) : index === 2 ? context.colors.subtitle(line) : context.colors.danger(line)).join('\n');
    return `${art}\n${context.colors.brand('  OpenMemory')} ${context.colors.muted('· Hydrograph memory for agents')}`;
}

export function emit(context: cli_context, value: unknown, human: () => string): void {
    if (context.silent) {
        if (context.json) context.io.stdout(render_json(value, context.pretty));
        return;
    }
    context.io.stdout(context.json ? render_json(value, context.pretty) : human());
}

export const section = (context: cli_context, title: string, content: string) => `${context.colors.title(title)}\n${content.split('\n').map((line) => `  ${line}`).join('\n')}`;