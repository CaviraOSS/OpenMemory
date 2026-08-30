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
 *  file  : src/core/project/project_sessions.ts
 *  usage : implements the LongMemory project sessions component
 */

import type { long_memory } from '../create_memory.js';
import type { ProjectWorld } from './project_world.js';
import type { project_state } from './project_state.js';
import { ingest_project_event } from './project_ingest.js';
import type { memory_asset_status, memory_asset_visibility } from './project_assets.js';

export type project_session_role = 'system' | 'user' | 'assistant' | 'tool';

export type project_session_message = {
    role: project_session_role;
    content: string;
    at?: number;
    name?: string;
    tool_call_id?: string;
};

export type project_session_input = {
    session_id: string;
    agent_id: string;
    provider: string;
    messages: project_session_message[];
    started_at?: number;
    source_ref?: string;
    metadata?: Record<string, unknown>;
    asset_id?: string;
    asset_name?: string;
    asset_status?: memory_asset_status;
    asset_visibility?: memory_asset_visibility;
};

export type project_session = {
    session_id: string;
    project_id: string;
    agent_id: string;
    provider: string;
    source_ref: string | null;
    message_count: number;
    node_ids: string[];
    started_at: number;
    ended_at: number;
};

const required = (value: string, name: string): string => {
    const clean = value.trim();
    if (!clean) throw new Error(`${name} is required`);
    return clean;
};

export async function import_project_session(memory: long_memory, project: ProjectWorld, state: project_state, input: project_session_input): Promise<project_session> {
    const session_id = required(input.session_id, 'session_id');
    const agent_id = required(input.agent_id, 'agent_id');
    const provider = required(input.provider, 'provider');
    if (!Array.isArray(input.messages) || !input.messages.length) throw new Error('session messages must contain at least one message');
    if (input.messages.length > 10_000) throw new Error('session messages cannot exceed 10000 entries');
    const fallback_at = input.started_at ?? Date.now();
    let prior_at = -Infinity;
    const messages = input.messages.map((message, index) => {
        if (!['system', 'user', 'assistant', 'tool'].includes(message.role)) throw new Error(`invalid session role at message ${index}`);
        const content = required(message.content, `message ${index} content`);
        const at = message.at ?? fallback_at + index;
        if (!Number.isFinite(at)) throw new Error(`message ${index} timestamp must be finite`);
        if (at < prior_at) throw new Error(`session timestamps must be monotonic at message ${index}`);
        prior_at = at;
        return { ...message, content, at };
    });
    if ((await list_project_sessions(memory, state)).some((session) => session.session_id === session_id)) {
        throw new Error(`session ${session_id} is already imported in project ${project.project_id}`);
    }
    const node_ids: string[] = [];
    for (let index = 0; index < messages.length; index++) {
        const message = messages[index];
        node_ids.push(await ingest_project_event(memory, project, state, {
            id: `session:${session_id}:${index}`, kind: 'session_turn', topic: `${session_id}:${index}`, text: message.content,
            at: message.at, observed_at: message.at, valid_from: message.at, subjective: true, replace_current: false,
            source_type: 'agent_session', external_id: `${session_id}:${index}`, url: input.source_ref, source_id: provider,
            metadata: {
                ...input.metadata, session_id, agent_id, provider, session_role: message.role, session_sequence: index,
                message_name: message.name ?? null, tool_call_id: message.tool_call_id ?? null, source_ref: input.source_ref ?? null,
            },
        }));
    }
    return {
        session_id, project_id: project.project_id, agent_id, provider, source_ref: input.source_ref ?? null,
        message_count: messages.length, node_ids, started_at: messages[0].at, ended_at: messages.at(-1)?.at ?? messages[0].at,
    };
}

export async function list_project_sessions(memory: long_memory, state: project_state): Promise<project_session[]> {
    const grouped = new Map<string, project_session>();
    const nodes = await Promise.all([...state.session_nodes].map((id) => memory.explain(id)));
    for (const entry of nodes) {
        const node = entry.node;
        if (!node || node.state.status !== 'active' || typeof node.metadata.session_id !== 'string') continue;
        const session_id = node.metadata.session_id;
        const current = grouped.get(session_id) ?? {
            session_id, project_id: state.project.project_id, agent_id: String(node.metadata.agent_id ?? 'unknown'),
            provider: String(node.metadata.provider ?? 'unknown'), source_ref: typeof node.metadata.source_ref === 'string' ? node.metadata.source_ref : null,
            message_count: 0, node_ids: [], started_at: node.temporal.observed_at, ended_at: node.temporal.observed_at,
        };
        current.message_count++;
        current.node_ids.push(node.id);
        current.started_at = Math.min(current.started_at, node.temporal.observed_at);
        current.ended_at = Math.max(current.ended_at, node.temporal.observed_at);
        grouped.set(session_id, current);
    }
    return [...grouped.values()].sort((left, right) => right.ended_at - left.ended_at || left.session_id.localeCompare(right.session_id));
}