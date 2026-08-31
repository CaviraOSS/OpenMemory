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
 *  file  : src/cli/commands/porter/common.ts
 *  usage : implements the LongMemory common component
 */


import type { harness_id } from '../../porter/types.js';
import type { porter_event, port_outcome } from '../../porter/orchestrator.js';

export const harness_ids: harness_id[] = ['claude-code', 'codex', 'opencode', 'gemini-cli', 'copilot-chat', 'cline', 'deepseek-harness'];

export const parse_harness = (value: string | undefined): harness_id => {
    if (!value || !harness_ids.includes(value as harness_id)) throw new Error(`harness must be one of ${harness_ids.join(', ')}`);
    return value as harness_id;
};

export const format_event = (event: porter_event): string => [event.type, event.harness, event.source_session_id, event.current !== undefined && event.total !== undefined ? `${event.current}/${event.total}` : null, event.message]
    .filter((value) => value !== undefined && value !== null && value !== '').join(' ');

export const outcome_counts = (outcomes: port_outcome[]) => ({
    created: outcomes.filter((outcome) => outcome.status === 'created').length,
    updated: outcomes.filter((outcome) => outcome.status === 'updated').length,
    skipped: outcomes.filter((outcome) => outcome.status === 'skipped').length,
    errors: outcomes.filter((outcome) => outcome.status === 'error').length,
});