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