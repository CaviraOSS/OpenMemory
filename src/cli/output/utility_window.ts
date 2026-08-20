import type { cli_colors } from '../theme/colors.js';
import { pad, repeat, truncate, visible_length, wrap_text } from '../theme/layout.js';
import { traffic_dots } from './panel.js';

export type utility_window_options = {
    title?: string;
    phase?: number;
    phases?: string[];
    width?: number;
    rows?: Array<[string, unknown]>;
    list?: string;
    footer?: string;
};

export function utility_window(content: string | string[], colors: cli_colors, options: utility_window_options = {}): string {
    const width = Math.max(36, options.width ?? 80);
    const inner = width - 4;
    const title = truncate(options.title ?? 'OpenMemory Transfer', inner - 10);
    const titlebar = `${traffic_dots(colors)}  ${colors.title(title)}`;
    const phases = options.phases ?? ['Library', 'Review', 'Transfer'];
    const active = Math.max(0, Math.min(options.phase ?? 0, phases.length - 1));
    const phasebar = phases.map((label, index) => {
        const marker = index < active ? colors.success('✓') : index === active ? colors.info('●') : colors.dim('○');
        const text = index === active ? colors.title(label) : colors.muted(label);
        return `${marker} ${text}`;
    }).join(colors.dim('  ›  '));
    const mark = [
        `${colors.brand('╭┬╮')}  ${colors.title('OpenMemory')}`,
        `${colors.brand('├┼┤')}  ${colors.subtitle('Conversation Transfer')}`,
        `${colors.brand('╰┴╯')}  ${colors.muted('Local-first memory for agents')}`,
    ];
    const lines = Array.isArray(content) ? content : wrap_text(content, inner);
    const rows = options.rows ?? [];
    const key_width = rows.length ? Math.min(14, Math.max(...rows.map(([key]) => key.length))) : 0;
    const body = [
        ...mark,
        '',
        phasebar,
        '',
        ...lines,
        ...rows.map(([key, value]) => `${colors.muted(pad(key, key_width))}  ${truncate(String(value ?? '—'), inner - key_width - 2)}`),
    ];
    if (options.list) body.push('', colors.border(repeat('─', inner)), ...options.list.split('\n'));
    if (options.footer) body.push('', colors.dim(truncate(options.footer, inner)));
    const top = `${colors.border('╭')}${colors.border(repeat('─', width - 2))}${colors.border('╮')}`;
    const rule = `${colors.border('├')}${colors.border(repeat('─', width - 2))}${colors.border('┤')}`;
    const line = (value: string) => `${colors.border('│')} ${pad(truncate(value, inner), inner)} ${colors.border('│')}`;
    return [top, line(titlebar), rule, ...body.map(line), `${colors.border('╰')}${colors.border(repeat('─', width - 2))}${colors.border('╯')}`].join('\n');
}