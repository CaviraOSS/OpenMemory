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
 *  file  : src/cli/porter/preview.ts
 *  usage : implements the LongMemory preview component
 */


import type { portable_session } from './types.js';

const blocks = [
    /<system_instruction>[\s\S]*?<\/system_instruction>/gi,
    /<system-reminder>[\s\S]*?<\/system-reminder>/gi,
    /<user-prompt-submit-hook>[\s\S]*?<\/user-prompt-submit-hook>/gi,
    /<instructions>[\s\S]*?<\/instructions>/gi,
    /<local-command-(?:caveat|stdout|stderr)>[\s\S]*?<\/local-command-(?:caveat|stdout|stderr)>/gi,
];
const ansi = /\u001b\[[0-9;]*[a-z]/gi;
const prefixes = ['# agents.md', 'you are working inside conductor', 'caveat:', '[request interrupted'];

export const clean_turn_preview = (raw: string): string => {
    const value = raw.trim();
    if (!value) return '';
    const command = value.match(/<command-(?:name|message)>\s*([^<]+?)\s*<\/command-(?:name|message)>/i)?.[1]?.trim();
    if (command) return command;
    let clean = value.replace(ansi, '');
    for (const block of blocks) clean = clean.replace(block, ' ');
    clean = clean.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!clean || prefixes.some((prefix) => clean.toLocaleLowerCase().startsWith(prefix))) return '';
    return clean;
};

export const derive_session_preview = (values: Iterable<string>, max = 72): string => {
    const clean = [...values].map(clean_turn_preview).filter(Boolean);
    if (!clean.length) return '';
    let result = clean[0] as string;
    for (let index = 1; index < clean.length && result.length < 24; index++) result += ` · ${clean[index]}`;
    return result.length <= max ? result : `${result.slice(0, Math.max(0, max - 1))}…`;
};

export const session_activity = (session: portable_session): number => session.updated_at
    ?? [...session.turns].reverse().find((turn) => turn.timestamp !== undefined)?.timestamp
    ?? session.created_at
    ?? 0;

export const group_sessions_by_project = (sessions: portable_session[]): Array<[string, portable_session[]]> => {
    const groups = new Map<string, portable_session[]>();
    for (const session of sessions) groups.set(session.cwd, [...(groups.get(session.cwd) ?? []), session]);
    const values = [...groups.entries()];
    for (const [, group] of values) group.sort((left, right) => session_activity(right) - session_activity(left));
    return values.sort((left, right) => Math.max(...right[1].map(session_activity)) - Math.max(...left[1].map(session_activity)));
};