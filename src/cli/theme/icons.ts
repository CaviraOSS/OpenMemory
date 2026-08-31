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
 *  file  : src/cli/theme/icons.ts
 *  usage : implements the LongMemory icons component
 */


export const icons = {
    memory: '◈', project: '◆', world: '◎', entity: '◇', decision: '▣', task: '□', conflict: '!',
    warning: '!', error: '×', success: '✓', grounded: '●', ungrounded: '○', stale: '◷', strict: '◆',
    historical: '◴', associative: '✦', world_grounded: '◎', connector: '⌁', github: 'GH', docs: 'DOC',
    youtube: 'YT', agent: '>', mcp: 'MCP', server: '◉', branch: '├─', last_branch: '└─', pipe: '│ ',
} as const;