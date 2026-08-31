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
 *  file  : src/cli/output/json.ts
 *  usage : implements the LongMemory json component
 */


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