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
 *  file  : src/connectors/local/markdown_parser.ts
 *  usage : implements the LongMemory markdown parser component
 */

import { createHash } from 'node:crypto';

export type markdown_section = {
    key: string;
    heading: string;
    level: number;
    path: string[];
    content: string;
    start_line: number;
    end_line: number;
    checksum: string;
};

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';

export function parse_markdown_sections(content: string): markdown_section[] {
    const lines = content.split(/\r?\n/);
    const headings: Array<{ line: number; level: number; heading: string }> = [];
    let fence = false;
    for (let index = 0; index < lines.length; index++) {
        if (/^\s*```/.test(lines[index])) fence = !fence;
        if (fence) continue;
        const match = lines[index].match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
        if (match) headings.push({ line: index, level: match[1].length, heading: match[2] });
    }
    if (!headings.length) return [{ key: 'document', heading: 'Document', level: 1, path: ['Document'], content, start_line: 1, end_line: lines.length, checksum: hash(content) }];
    const sections: markdown_section[] = [];
    const path: string[] = [];
    for (let index = 0; index < headings.length; index++) {
        const current = headings[index];
        path.splice(current.level - 1);
        path[current.level - 1] = current.heading;
        const end = (headings[index + 1]?.line ?? lines.length) - 1;
        const text = lines.slice(current.line, end + 1).join('\n').trim();
        sections.push({
            key: `${path.map(slug).join('/')}:${current.line + 1}`,
            heading: current.heading,
            level: current.level,
            path: [...path.filter(Boolean)],
            content: text,
            start_line: current.line + 1,
            end_line: end + 1,
            checksum: hash(text),
        });
    }
    return sections;
}