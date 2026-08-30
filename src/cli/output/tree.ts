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
 *  file  : src/cli/output/tree.ts
 *  usage : implements the LongMemory tree component
 */

import type { cli_colors } from '../theme/colors.js';

export type tree_node = { label: string; detail?: string; children?: tree_node[] };

export function tree(nodes: tree_node[], colors: cli_colors, prefix = ''): string {
    const lines: string[] = [];
    nodes.forEach((node, index) => {
        const last = index === nodes.length - 1;
        lines.push(`${prefix}${colors.border(last ? '└─' : '├─')} ${node.label}${node.detail ? ` ${colors.muted(node.detail)}` : ''}`);
        if (node.children?.length) lines.push(tree(node.children, colors, `${prefix}${last ? '   ' : `${colors.border('│')}  `}`));
    });
    return lines.join('\n');
}