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
 *  file  : src/cli/output/panel.ts
 *  usage : implements the LongMemory panel component
 */


import type { cli_colors } from '../theme/colors.js';
import { pad, repeat, truncate, visible_length, wrap_text } from '../theme/layout.js';

export type panel_kind = 'normal' | 'success' | 'warning' | 'danger' | 'info' | 'muted';
export type panel_options = { title?: string; kind?: panel_kind; width?: number; rows?: Array<[string, unknown]>; chrome?: boolean; mark?: boolean };

export const traffic_dots = (colors: cli_colors) => `${colors.danger('●')} ${colors.warning('●')} ${colors.success('●')}`;

export function panel(content: string | string[], colors: cli_colors, options: panel_options = {}): string {
    const width = Math.max(32, options.width ?? 80);
    const inner = width - 4;
    const paint = options.kind === 'success' ? colors.success : options.kind === 'warning' ? colors.warning
        : options.kind === 'danger' ? colors.danger : options.kind === 'info' ? colors.info
            : options.kind === 'muted' ? colors.muted : colors.border;
    const chrome = options.chrome !== false;
    const right = options.mark === false ? '' : `${colors.brand('╭┬╮')} ${colors.muted('LongMemory')}`;
    const title_budget = Math.max(0, inner - (chrome ? 7 : 2) - visible_length(right));
    const title = options.title ? truncate(options.title, title_budget) : '';
    const left = chrome ? `${traffic_dots(colors)}${title ? `  ${colors.title(title)}` : ''}` : title ? colors.title(title) : '';
    const top = chrome
        ? `${paint('╭')} ${left}${paint(repeat('─', inner - visible_length(left) - visible_length(right)))}${right} ${paint('╮')}`
        : `${paint('╭─')}${colors.title(title ? ` ${title} ` : '')}${paint(repeat('─', inner - visible_length(title ? ` ${title} ` : '') + 1))}${paint('╮')}`;
    const lines = Array.isArray(content) ? content : wrap_text(content, inner);
    const rows = options.rows ?? [];
    const key_width = rows.length ? Math.min(14, Math.max(...rows.map(([key]) => key.length))) : 0;
    const body = [
        ...lines,
        ...rows.map(([key, value]) => `${colors.muted(pad(key, key_width))}  ${truncate(String(value ?? '—'), inner - key_width - 2)}`),
    ].map((line) => `${paint('│')} ${pad(truncate(line, inner), inner)} ${paint('│')}`);
    return [top, ...body, `${paint('╰')}${paint(repeat('─', width - 2))}${paint('╯')}`].join('\n');
}