import type { cli_colors } from './colors.js';

export const badge_names = [
    'ACTIVE', 'STALE', 'SUPERSEDED', 'CONTRADICTED', 'GROUNDED', 'UNGROUNDED', 'STRICT', 'HISTORICAL',
    'ASSOCIATIVE', 'WORLD', 'BLOCKED', 'DONE', 'OPEN', 'FAILED', 'SYNCED', 'DRY RUN',
] as const;
export type badge_name = typeof badge_names[number];

export function badge(name: badge_name, human: boolean, colors: cli_colors): string {
    if (!human) return name;
    const paint = name === 'ACTIVE' || name === 'DONE' || name === 'SYNCED' ? colors.success
        : name === 'FAILED' || name === 'CONTRADICTED' || name === 'BLOCKED' ? colors.danger
            : name === 'STALE' || name === 'UNGROUNDED' || name === 'DRY RUN' ? colors.warning
                : name === 'ASSOCIATIVE' ? colors.associative
                    : name === 'WORLD' || name === 'GROUNDED' ? colors.world_grounded
                        : name === 'STRICT' ? colors.strict
                            : name === 'HISTORICAL' || name === 'SUPERSEDED' ? colors.historical : colors.info;
    return paint(`[${name}]`);
}

export const status_badge = (status: string): badge_name => {
    const value = status.toLowerCase();
    if (['complete', 'completed', 'done', 'resolved', 'pass', 'passed'].includes(value)) return 'DONE';
    if (['blocked'].includes(value)) return 'BLOCKED';
    if (['failed', 'error'].includes(value)) return 'FAILED';
    if (value === 'stale') return 'STALE';
    if (value === 'superseded') return 'SUPERSEDED';
    if (value === 'contradicted') return 'CONTRADICTED';
    return value === 'active' ? 'ACTIVE' : 'OPEN';
};