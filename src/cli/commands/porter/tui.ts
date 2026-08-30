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
 *  file  : src/cli/commands/porter/tui.ts
 *  usage : implements the LongMemory tui component
 */

import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import type { cli_command } from '../../context/cli_context.js';
import { command_flags, with_project } from '../../context/cli_context.js';
import { table } from '../../output/table.js';
import { utility_window } from '../../output/utility_window.js';
import { detect_harnesses } from '../../porter/detect.js';
import { discover_sessions, port_sessions, type porter_event } from '../../porter/orchestrator.js';
import type { harness_id } from '../../porter/types.js';
import { format_event, outcome_counts } from './common.js';

export const parse_session_selection = (value: string, total: number): number[] => {
    const clean = value.trim().toLocaleLowerCase();
    if (clean === 'all' || clean === '*') return Array.from({ length: total }, (_, index) => index);
    const selected = new Set<number>();
    for (const part of clean.split(',').map((item) => item.trim()).filter(Boolean)) {
        const range = part.match(/^(\d+)-(\d+)$/);
        if (range) {
            const start = Number(range[1]);
            const end = Number(range[2]);
            for (let value = Math.min(start, end); value <= Math.max(start, end); value++) if (value >= 1 && value <= total) selected.add(value - 1);
            continue;
        }
        const index = Number(part);
        if (Number.isInteger(index) && index >= 1 && index <= total) selected.add(index - 1);
    }
    return [...selected].sort((left, right) => left - right);
};

export const display_workspace = (value: string) => value.split(/[\\/]/).filter(Boolean).at(-1) || 'unknown';
export const display_timestamp = (value?: number) => value ? new Date(value).toISOString().slice(0, 16).replace('T', ' ') : '—';

type screen_options = { rows?: Array<[string, unknown]>; list?: string; footer?: string };

const screen = (context: Parameters<cli_command>[0], phase: number, title: string, detail: string, options: screen_options = {}) => context.io.stdout(utility_window(detail, context.colors, {
    title, phase, width: context.terminal_width, footer: 'Local archive access · source files stay unchanged', ...options,
}));

export const tui_command: cli_command = async (context) => {
    command_flags(context, []);
    if (!context.is_tty) throw new Error('longmemory tui requires an interactive terminal; use detect, session discover, or port for automation');
    const prompt = createInterface({ input: stdin, output: stdout });
    const ask = (question: string) => prompt.question(`${context.colors.info('❯')} ${question}`);
    try {
        const available = (await detect_harnesses(context.env)).filter((item) => item.can_import);
        if (!available.length) throw new Error('no readable supported AI conversation stores were found');
        screen(context, 0, 'Conversation Library', 'Choose a local conversation archive. LongMemory will preview its history before anything is transferred.', {
            rows: [
                ['workspace', context.project_id],
                ['archives', `${available.length} readable`],
                ['destination', context.db_path],
                ['source access', 'read only'],
            ],
            list: table(available.map((item, index) => ({ number: index + 1, archive: item.harness, access: 'read only', location: item.source_path })), [{ key: 'number', label: '#', width: 2 }, { key: 'archive', label: 'LOCAL ARCHIVE', width: 16 }, { key: 'access', label: 'ACCESS', width: 10 }, { key: 'location', label: 'LOCATION', min: 20 }], context.colors, context.terminal_width - 4),
            footer: 'Nothing leaves this machine · source files stay unchanged',
        });
        const source_index = Number(await ask('Open archive number: ')) - 1;
        const source = available[source_index]?.harness;
        if (!source) throw new Error('invalid source selection');
        const destination = (await ask(`Add conversations to ${context.project_id}? [Y/n] `)).trim().toLocaleLowerCase();
        if (destination === 'n' || destination === 'no') return;

        const refs = await discover_sessions(source, context.env);
        if (!refs.length) throw new Error(`${source} has no portable sessions`);
        const shown = refs.slice(0, 100);
        screen(context, 1, 'Review Conversations', 'Select only the conversations that should become governed project memory. New or changed history creates an immutable revision.', {
            rows: [
                ['archive', source],
                ['workspace', context.project_id],
                ['discovered', refs.length],
                ['shown', `${shown.length}${refs.length > shown.length ? ' most recent' : ''}`],
                ['asset', 'Chat Memory · candidate'],
            ],
            list: table(shown.map((ref, index) => ({ number: index + 1, workspace: display_workspace(ref.cwd), conversation: ref.title, modified: display_timestamp(ref.updated_at) })), [{ key: 'number', label: '#', width: 3 }, { key: 'workspace', label: 'WORKSPACE', min: 14 }, { key: 'conversation', label: 'CONVERSATION', min: 24 }, { key: 'modified', label: 'MODIFIED', width: 16 }], context.colors, context.terminal_width - 4),
            footer: 'Selection: all · comma list 1,3,5 · range 2-6',
        });
        const selected = parse_session_selection(await ask('Keep conversations (all, 1,3, 2-5): '), shown.length);
        if (!selected.length) throw new Error('no sessions selected');
        const ids = selected.map((index) => (shown[index] as { source_session_id: string }).source_session_id);
        const agent_id = (await ask(`Attribute to [${source}]: `)).trim() || source;

        screen(context, 2, 'Transfer in Progress', `Creating immutable Chat Memory revisions for ${ids.length} conversation${ids.length === 1 ? '' : 's'}.`, {
            rows: [
                ['from', source],
                ['to', context.project_id],
                ['agent', agent_id],
                ['selected', ids.length],
                ['revision', 'create · update · skip unchanged'],
                ['governance', 'project scoped · candidate'],
            ],
            footer: 'Each conversation is isolated · one failure will not stop the batch',
        });
        const on_event = (event: porter_event) => {
            if (event.type === 'import:progress') context.io.stdout(`  ${context.colors.dim('·')} ${context.colors.dim(format_event(event))}`);
            if (event.type === 'error') context.io.stdout(`  ${context.colors.danger('✕')} ${context.colors.danger(format_event(event))}`);
        };
        const outcomes = await with_project(context, (project) => port_sessions(project, context.project_id, source as harness_id, { ids, agent_id, env: context.env, on_event }));
        const counts = outcome_counts(outcomes);

        screen(context, 2, 'Transfer Receipt', 'The selected conversations are now available through governed project memory.', {
            rows: [
                ['processed', outcomes.length],
                ['created', counts.created],
                ['updated', counts.updated],
                ['unchanged', counts.skipped],
                ['errors', counts.errors],
                ['asset type', 'Chat Memory'],
            ],
            list: table(outcomes.map((outcome) => ({ conversation: outcome.source_session_id, result: outcome.status, memory: outcome.asset_id })), [{ key: 'conversation', label: 'CONVERSATION', min: 14 }, { key: 'result', label: 'RESULT', width: 9 }, { key: 'memory', label: 'MEMORY RECORD', min: 24 }], context.colors, context.terminal_width - 4),
            footer: counts.errors ? 'Review error rows above · successful revisions were preserved' : 'Complete · source archives were not modified',
        });
    } finally { prompt.close(); }
};