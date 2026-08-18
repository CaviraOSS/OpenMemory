import type { cli_colors } from '../theme/colors.js';
import { panel } from './panel.js';

const states = {
    project: ['No project initialized', 'Run openmemory project init'],
    memories: ['No memories found', 'Run openmemory ingest "something worth remembering"'],
    connectors: ['No connectors configured', 'Run openmemory connectors list'],
    conflicts: ['No unresolved conflicts', 'Project memory is consistent.'],
    tasks: ['No open tasks', 'Record work with openmemory agent after-run'],
    decisions: ['No decisions recorded', 'Use project memory to preserve architectural choices.'],
} as const;
export type empty_state_kind = keyof typeof states;

export const empty_state = (kind: empty_state_kind, colors: cli_colors, width: number) => panel(states[kind][1], colors, { title: states[kind][0], kind: 'muted', width });