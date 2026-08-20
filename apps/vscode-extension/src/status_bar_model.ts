import type { status_result } from './types.js';

export type status_bar_tracker = { active: string | null; pending: number };
export type status_bar_model = {
    memory_text: string;
    memory_tooltip: string;
    memory_severity: 'normal' | 'warning' | 'error';
    activity: null | { text: string; tooltip: string; review: boolean };
};

export const build_status_bar_model = (value: status_result | null, tracker: status_bar_tracker, error?: string): status_bar_model => {
    const unavailable = Boolean(error && !/not initialized|has not loaded|open a workspace/i.test(error));
    const memory_text = value ? `$(database) Memory ${value.memory.active}` : unavailable ? '$(warning) Memory' : '$(database) Memory';
    const memory_tooltip = value
        ? `OpenMemory · ${value.project.name}\n\n${value.memory.active} active / ${value.memory.nodes} total memories\n${value.memory.grounded} grounded · ${value.memory.superseded} superseded\n${value.unresolved_conflicts} unresolved conflicts\nDatabase: ${value.db_path}\n\nClick to manage memory, context, imports, and maintenance.`
        : error ? `${error}\n\nClick to open OpenMemory Manager.` : 'OpenMemory workspace memory. Click to manage.';
    const memory_severity = unavailable ? 'error' : value?.unresolved_conflicts ? 'warning' : 'normal';
    const activity = tracker.active ? {
        text: `$(record) ${tracker.active}${tracker.pending ? ` · $(diff) ${tracker.pending}` : ''}`,
        tooltip: `Recording explicit ${tracker.active} changes${tracker.pending ? ` · ${tracker.pending} candidate(s) waiting` : ''}. Click to manage.`,
        review: false,
    } : tracker.pending ? {
        text: `$(diff) ${tracker.pending}`,
        tooltip: `${tracker.pending} AI change candidate${tracker.pending === 1 ? '' : 's'} waiting for review.`,
        review: true,
    } : null;
    return { memory_text, memory_tooltip, memory_severity, activity };
};
