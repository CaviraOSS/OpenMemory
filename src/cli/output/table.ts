import type { cli_colors } from '../theme/colors.js';
import { pad, truncate, visible_length } from '../theme/layout.js';

export type table_column = { key: string; label: string; width?: number; min?: number };

export function table(rows: Array<Record<string, unknown>>, columns: table_column[], colors: cli_colors, width = 80): string {
    if (!rows.length) return '';
    const gap = 2;
    const available = Math.max(20, width - gap * (columns.length - 1));
    const natural = columns.map((column) => Math.max(column.min ?? 5, Math.min(column.width ?? 30, Math.max(column.label.length, ...rows.map((row) => String(row[column.key] ?? '').length)))));
    let total = natural.reduce((sum, value) => sum + value, 0);
    while (total > available) {
        const index = natural.reduce((best, value, item) => value > natural[best] && value > (columns[item].min ?? 5) ? item : best, 0);
        if (natural[index] <= (columns[index].min ?? 5)) break;
        natural[index]--; total--;
    }
    const format = (row: Record<string, unknown>) => columns.map((column, index) => pad(truncate(String(row[column.key] ?? '—'), natural[index]), natural[index])).join(' '.repeat(gap)).trimEnd();
    const header = columns.map((column, index) => pad(truncate(column.label, natural[index]), natural[index])).join(' '.repeat(gap)).trimEnd();
    const divider = columns.map((_, index) => '─'.repeat(natural[index])).join(' '.repeat(gap));
    return [colors.muted(header), colors.border(divider), ...rows.map(format)].join('\n');
}

export const table_width = (value: string) => Math.max(...value.split('\n').map(visible_length));