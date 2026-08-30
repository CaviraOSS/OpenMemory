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
 *  file  : src/cli/output/empty_state.ts
 *  usage : implements the LongMemory empty state component
 */

import type { cli_colors } from '../theme/colors.js';
import { panel } from './panel.js';

const states = {
    project: ['No project initialized', 'Run longmemory project init'],
    memories: ['No memories found', 'Run longmemory ingest "something worth remembering"'],
    connectors: ['No connectors configured', 'Run longmemory connectors list'],
    conflicts: ['No unresolved conflicts', 'Project memory is consistent.'],
    tasks: ['No open tasks', 'Record work with longmemory agent after-run'],
    decisions: ['No decisions recorded', 'Use project memory to preserve architectural choices.'],
} as const;
export type empty_state_kind = keyof typeof states;

export const empty_state = (kind: empty_state_kind, colors: cli_colors, width: number) => panel(states[kind][1], colors, { title: states[kind][0], kind: 'muted', width });