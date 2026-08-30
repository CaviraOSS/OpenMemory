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
 *  file  : src/cli/porter/orchestrator.ts
 *  usage : implements the LongMemory orchestrator component
 */

import { hash_canonical } from '../../core/hash/content_hash.js';
import type { project_memory } from '../../core/project/project_memory.js';
import { get_import_adapter } from './detect.js';
import type { harness_id, portable_session, session_ref } from './types.js';

export type porter_event = {
    type: 'discover:start' | 'discover:done' | 'import:start' | 'import:progress' | 'import:done' | 'error';
    harness: harness_id;
    source_session_id?: string;
    current?: number;
    total?: number;
    message?: string;
};

export type port_outcome = {
    source_harness: harness_id;
    source_session_id: string;
    asset_id: string;
    imported_session_id?: string;
    status: 'created' | 'updated' | 'skipped' | 'error';
    reason?: string;
    error?: string;
};

export type port_options = {
    ids?: string[];
    all?: boolean;
    force?: boolean;
    agent_id?: string;
    on_event?: (event: porter_event) => void;
    env?: NodeJS.ProcessEnv;
};

const asset_id_for = (session: Pick<portable_session, 'source_harness' | 'source_session_id'>): string =>
    `asset:chat_memory:porter:${hash_canonical([session.source_harness, session.source_session_id]).slice(0, 24)}`;

export const parse_failure_outcome = (harness: harness_id, source_session_id: string, error: string): port_outcome => ({
    source_harness: harness, source_session_id,
    asset_id: asset_id_for({ source_harness: harness, source_session_id }),
    status: 'error', error,
});

export const session_revision = (session: portable_session): string => hash_canonical({
    schema_version: session.schema_version, source_harness: session.source_harness, source_session_id: session.source_session_id,
    cwd: session.cwd, title: session.title, turns: session.turns, dropped_turns: session.dropped_turns,
});

const messages = (session: portable_session) => {
    let cursor = session.created_at ?? session.turns.find((turn) => turn.timestamp !== undefined)?.timestamp ?? Date.now();
    let normalized = false;
    const values = session.turns.map((turn) => {
        const requested = turn.timestamp ?? cursor;
        const at = Math.max(cursor, requested);
        if (at !== requested) normalized = true;
        cursor = at + 1;
        return { role: turn.role, content: turn.text, at, name: turn.name, tool_call_id: turn.tool_call_id };
    });
    return { values, normalized };
};

export async function discover_sessions(harness: harness_id, env: NodeJS.ProcessEnv = process.env): Promise<session_ref[]> {
    const adapter = get_import_adapter(harness);
    const capability = await adapter.detect(env);
    if (!capability.can_import) throw new Error(capability.note ?? `${harness} is not available as a session source`);
    return adapter.discover(env);
}

export async function parse_sessions(harness: harness_id, refs: session_ref[], env: NodeJS.ProcessEnv = process.env, on_event?: port_options['on_event']): Promise<portable_session[]> {
    const adapter = get_import_adapter(harness);
    const results: portable_session[] = [];
    for (let index = 0; index < refs.length; index++) {
        const ref = refs[index] as session_ref;
        try {
            const session = await adapter.parse(ref, env);
            if (!session.turns.length) throw new Error('session has no portable text turns');
            results.push(session);
        } catch (error) {
            on_event?.({ type: 'error', harness, source_session_id: ref.source_session_id, current: index + 1, total: refs.length, message: error instanceof Error ? error.message : String(error) });
        }
        on_event?.({ type: 'import:progress', harness, source_session_id: ref.source_session_id, current: index + 1, total: refs.length });
        await new Promise<void>((resolve) => setImmediate(resolve));
    }
    return results;
}

export async function port_sessions(project: project_memory, project_id: string, harness: harness_id, options: port_options = {}): Promise<port_outcome[]> {
    const env = options.env ?? process.env;
    options.on_event?.({ type: 'discover:start', harness });
    const discovered = await discover_sessions(harness, env);
    const selected_ids = new Set(options.ids ?? []);
    const selected = options.all ? discovered : discovered.filter((ref) => selected_ids.has(ref.source_session_id));
    if (selected_ids.size) {
        const found = new Set(selected.map((ref) => ref.source_session_id));
        const missing = [...selected_ids].filter((id) => !found.has(id));
        if (missing.length) throw new Error(`session ids were not found in ${harness}: ${missing.join(', ')}`);
    }
    options.on_event?.({ type: 'discover:done', harness, total: discovered.length, message: `${selected.length} selected` });
    options.on_event?.({ type: 'import:start', harness, total: selected.length });
    const parse_failures: port_outcome[] = [];
    const sessions = await parse_sessions(harness, selected, env, (event) => {
        options.on_event?.(event);
        if (event.type === 'error' && event.source_session_id) parse_failures.push(parse_failure_outcome(harness, event.source_session_id, event.message ?? 'session parse failed'));
    });
    const outcomes: port_outcome[] = [...parse_failures];
    for (const session of sessions) {
        const asset_id = asset_id_for(session);
        const revision = session_revision(session);
        try {
            const prior = await project.getAsset(project_id, asset_id);
            if (prior?.status === 'archived') throw new Error('the destination Chat Memory asset is archived');
            if (prior?.metadata.source_revision === revision) {
                if (!options.force) {
                    outcomes.push({ source_harness: harness, source_session_id: session.source_session_id, asset_id, status: 'skipped', reason: 'source revision already imported' });
                    continue;
                }
                const updated = await project.governAsset(project_id, asset_id, { metadata: { ...prior.metadata, forced_at: Date.now() } });
                outcomes.push({ source_harness: harness, source_session_id: session.source_session_id, asset_id, status: 'updated', reason: `forced asset version ${updated.version}` });
                continue;
            }
            const prepared = messages(session);
            const imported_session_id = `porter:${harness}:${session.source_session_id}:${revision.slice(0, 12)}`;
            await project.importSession(project_id, {
                session_id: imported_session_id,
                agent_id: options.agent_id ?? harness,
                provider: harness,
                started_at: session.created_at,
                source_ref: session.source_path,
                asset_id,
                asset_name: session.title,
                asset_status: prior?.status ?? 'candidate',
                asset_visibility: prior?.visibility ?? 'agent',
                messages: prepared.values,
                metadata: {
                    source_harness: harness, source_session_id: session.source_session_id, source_revision: revision,
                    source_path: session.source_path, cwd: session.cwd, title: session.title,
                    dropped_turns: session.dropped_turns, timestamps_normalized: prepared.normalized,
                    portable_schema_version: session.schema_version, source_metadata: session.source_metadata,
                },
            });
            outcomes.push({ source_harness: harness, source_session_id: session.source_session_id, asset_id, imported_session_id, status: prior ? 'updated' : 'created' });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            options.on_event?.({ type: 'error', harness, source_session_id: session.source_session_id, message });
            outcomes.push({ source_harness: harness, source_session_id: session.source_session_id, asset_id, status: 'error', error: message });
        }
    }
    options.on_event?.({ type: 'import:done', harness, current: outcomes.length, total: selected.length });
    return outcomes;
}

export async function verify_sessions(harness: harness_id, sample = 10, env: NodeJS.ProcessEnv = process.env): Promise<{ harness: harness_id; discovered: number; verified: number; failures: Array<{ source_session_id: string; error: string }> }> {
    const refs = await discover_sessions(harness, env);
    const selected = refs.slice(0, Math.max(1, sample));
    const failures: Array<{ source_session_id: string; error: string }> = [];
    const sessions = await parse_sessions(harness, selected, env, (event) => {
        if (event.type === 'error' && event.source_session_id) failures.push({ source_session_id: event.source_session_id, error: event.message ?? 'parse failed' });
    });
    return { harness, discovered: refs.length, verified: sessions.length, failures };
}