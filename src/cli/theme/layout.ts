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
 *  file  : src/cli/theme/layout.ts
 *  usage : implements the LongMemory layout component
 */

import { strip_ansi } from './colors.js';

export const layout = {
    max_width: 92,
    min_width: 36,
    indent: 2,
    box_padding: 1,
    table_spacing: 3,
    section_spacing: 1,
    truncation_mark: '…',
} as const;

export const terminal_width = (fallback = 80) => Math.max(layout.min_width, Math.min(layout.max_width, process.stdout.columns || fallback));
export const visible_length = (value: string) => strip_ansi(value).length;
export const repeat = (value: string, count: number) => value.repeat(Math.max(0, count));
export const truncate = (value: string, width: number) => {
    if (visible_length(value) <= width) return value;
    return `${strip_ansi(value).slice(0, Math.max(0, width - 1))}${layout.truncation_mark}`;
};
export const pad = (value: string, width: number) => `${value}${repeat(' ', width - visible_length(value))}`;
export const wrap_text = (value: string, width: number): string[] => {
    const words = value.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    if (!words.length) return [''];
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
        if (word.length > width) {
            if (line) lines.push(line);
            lines.push(truncate(word, width));
            line = '';
        } else if (!line || line.length + word.length + 1 <= width) line += `${line ? ' ' : ''}${word}`;
        else { lines.push(line); line = word; }
    }
    if (line) lines.push(line);
    return lines;
};