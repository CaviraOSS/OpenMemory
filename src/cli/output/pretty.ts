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
 *  file  : src/cli/output/pretty.ts
 *  usage : implements the LongMemory pretty component
 */


import type { cli_context } from '../context/cli_context.js';
import { render_json } from './json.js';

export function banner(context: cli_context): string {
    return [
        `${context.colors.brand('╭┬╮')}  ${context.colors.title('LongMemory')}`,
        `${context.colors.brand('├┼┤')}  ${context.colors.subtitle('Hydrograph memory for agents')}`,
        `${context.colors.brand('╰┴╯')}  ${context.colors.muted('Local-first · project-scoped · immutable')}`,
    ].join('\n');
}

export function emit(context: cli_context, value: unknown, human: () => string): void {
    if (context.silent) {
        if (context.json) context.io.stdout(render_json(value, context.pretty));
        return;
    }
    context.io.stdout(context.json ? render_json(value, context.pretty) : human());
}

export const section = (context: cli_context, title: string, content: string) => `${context.colors.title(title)}\n${content.split('\n').map((line) => `  ${line}`).join('\n')}`;