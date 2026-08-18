import { strip_ansi } from '../theme/colors.js';

const stable = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(stable);
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'bigint') return value.toString();
    if (!value || typeof value !== 'object') return typeof value === 'string' ? strip_ansi(value) : value;
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stable(item)]));
};

export const stable_value = stable;
export const render_json = (value: unknown, pretty = false) => JSON.stringify(stable(value), null, pretty ? 2 : 0);