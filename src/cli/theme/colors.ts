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
 *  file  : src/cli/theme/colors.ts
 *  usage : implements the LongMemory colors component
 */

const esc = '\u001b[';

export type color_fn = (value: unknown) => string;

const color = (code: string): color_fn => (value) => `${esc}${code}m${String(value)}${esc}0m`;
const plain: color_fn = (value) => String(value);

export type cli_colors = {
    brand: color_fn; title: color_fn; subtitle: color_fn; success: color_fn; warning: color_fn;
    danger: color_fn; info: color_fn; muted: color_fn; dim: color_fn; border: color_fn;
    active: color_fn; stale: color_fn; superseded: color_fn; contradicted: color_fn;
    grounded: color_fn; ungrounded: color_fn; strict: color_fn; historical: color_fn;
    associative: color_fn; world_grounded: color_fn;
};

export const ansi_pattern = /\u001b\[[0-9;]*m/g;
export const strip_ansi = (value: string) => value.replace(ansi_pattern, '');

export function create_colors(enabled: boolean): cli_colors {
    if (!enabled) return Object.fromEntries([
        'brand', 'title', 'subtitle', 'success', 'warning', 'danger', 'info', 'muted', 'dim', 'border',
        'active', 'stale', 'superseded', 'contradicted', 'grounded', 'ungrounded', 'strict', 'historical',
        'associative', 'world_grounded',
    ].map((key) => [key, plain])) as cli_colors;
    return {
        brand: color('38;5;45'), title: color('1;97'), subtitle: color('38;5;103'), success: color('38;5;48'),
        warning: color('38;5;214'), danger: color('38;5;203'), info: color('38;5;45'), muted: color('38;5;244'),
        dim: color('2;37'), border: color('38;5;67'), active: color('38;5;48'), stale: color('38;5;214'),
        superseded: color('38;5;244'), contradicted: color('38;5;203'), grounded: color('38;5;45'),
        ungrounded: color('38;5;214'), strict: color('38;5;48'), historical: color('38;5;103'),
        associative: color('38;5;141'), world_grounded: color('38;5;45'),
    };
}