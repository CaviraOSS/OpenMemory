import type { cli_colors } from '../theme/colors.js';
import { pad, repeat, truncate, visible_length, wrap_text } from '../theme/layout.js';

export type panel_kind = 'normal' | 'success' | 'warning' | 'danger' | 'info' | 'muted';
export type panel_options = { title?: string; kind?: panel_kind; width?: number; rows?: Array<[string, unknown]> };

export function panel(content: string | string[], colors: cli_colors, options: panel_options = {}): string {
    const width = Math.max(32, options.width ?? 80);
    const inner = width - 4;
    const paint = options.kind === 'success' ? colors.success : options.kind === 'warning' ? colors.warning
        : options.kind === 'danger' ? colors.danger : options.kind === 'info' ? colors.info
            : options.kind === 'muted' ? colors.muted : colors.border;
    const title = options.title ? ` ${truncate(options.title, inner - 2)} ` : '';
    const top = `${paint('╭─')}${colors.title(title)}${paint(repeat('─', inner - visible_length(title) + 1))}${paint('╮')}`;
    const lines = Array.isArray(content) ? content : wrap_text(content, inner);
    const rows = options.rows ?? [];
    const key_width = rows.length ? Math.min(14, Math.max(...rows.map(([key]) => key.length))) : 0;
    const body = [
        ...lines,
        ...rows.map(([key, value]) => `${colors.muted(pad(key, key_width))}  ${truncate(String(value ?? '—'), inner - key_width - 2)}`),
    ].map((line) => `${paint('│')} ${pad(truncate(line, inner), inner)} ${paint('│')}`);
    return [top, ...body, `${paint('╰')}${paint(repeat('─', width - 2))}${paint('╯')}`].join('\n');
}