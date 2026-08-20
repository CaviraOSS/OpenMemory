/*
 *   _____                 ___  ___
 *  |  _  |                |  \/  |
 *  | | | |_ __   ___ _ __ | .  . | ___ _ __ ___   ___  _ __ _   _
 *  | | | | '_ \ / _ \ '_ \| |\/| |/ _ \ '_ ` _ \ / _ \| '__| | | |
 *  \ \_/ / |_) |  __/ | | | |  | |  __/ | | | | | (_) | |  | |_| |
 *   \___/| .__/ \___|_| |_\_|  |_/\___|_| |_| |_|\___/|_|   \__, |
 *        | |                                                 __/ |
 *        |_|                                                |___/
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : src/core/project/project_state.ts
 *  usage : runtime indexes over durable project Hydrograph memory
 */

import type { connector_sync_report } from '../connectors/connector_ingest.js';
import type { Connector } from '../connectors/connector.js';
import type { HydroNode } from '../types/hydro_node.js';
import type { ProjectWorld, project_source_summary, project_world_kind } from './project_world.js';

export type project_event_kind = 'architecture' | 'decision' | 'requirement' | 'goal' | 'constraint' | 'task' | 'bug' | 'failure' | 'preference' | 'convention' | 'deployment' | 'risk' | 'question' | 'reference' | 'agent_state' | 'session_turn' | 'code_fact' | 'manual_fact' | 'skill' | 'asset';

export type project_event = {
    id?: string;
    kind: project_event_kind;
    text: string;
    topic?: string;
    at?: number;
    observed_at?: number;
    valid_from?: number;
    source_type?: string;
    external_id?: string;
    url?: string;
    source_id?: string;
    subjective?: boolean;
    replace_current?: boolean;
    entities?: Array<{ name: string; type?: 'person' | 'place' | 'organization' | 'project' | 'concept' | 'thing' | 'unknown'; aliases?: string[] }>;
    status?: 'open' | 'blocked' | 'completed' | 'stale' | 'active' | 'resolved';
    priority?: 'low' | 'medium' | 'high' | 'critical';
    owner?: string;
    repo?: string;
    branch?: string;
    commit?: string;
    file_path?: string;
    line_start?: number;
    line_end?: number;
    checksum?: string;
    alternatives_rejected?: string[];
    rationale?: string;
    files_touched?: string[];
    next_actions?: string[];
    metadata?: Record<string, unknown>;
};

export type project_node_record = {
    node_id: string;
    event_id: string;
    kind: project_event_kind | 'connector';
    topic: string;
    text: string;
    status: string | null;
    at: number;
};

export type project_source_link = project_source_summary & {
    connector: Connector;
    world_kind: project_world_kind;
};

export type agent_continuity_state = {
    last_active_task: string | null;
    current_plan: string[];
    pending_questions: string[];
    files_touched: string[];
    proposed_changes: string[];
    rejected_approaches: string[];
    test_results: string[];
    known_failures: string[];
    next_actions: string[];
    updated_at: number;
};

export class project_state {
    readonly nodes = new Map<string, project_node_record>();
    readonly current_by_topic = new Map<string, string>();
    readonly sources = new Map<string, project_source_link>();
    readonly sync_reports: connector_sync_report[] = [];
    readonly code_nodes = new Set<string>();
    readonly decision_nodes = new Set<string>();
    readonly task_nodes = new Set<string>();
    readonly convention_nodes = new Set<string>();
    readonly failure_nodes = new Set<string>();
    readonly risk_nodes = new Set<string>();
    readonly question_nodes = new Set<string>();
    readonly goal_nodes = new Set<string>();
    readonly constraint_nodes = new Set<string>();
    readonly deployment_nodes = new Set<string>();
    readonly skill_nodes = new Set<string>();
    readonly session_nodes = new Set<string>();
    readonly asset_nodes = new Set<string>();
    agent: agent_continuity_state = {
        last_active_task: null, current_plan: [], pending_questions: [], files_touched: [], proposed_changes: [],
        rejected_approaches: [], test_results: [], known_failures: [], next_actions: [], updated_at: 0,
    };

    constructor(readonly project: ProjectWorld) { }

    record(node: HydroNode, event: project_event, event_id: string): void {
        const topic = event.topic ?? event.kind;
        this.nodes.set(node.id, { node_id: node.id, event_id, kind: event.kind, topic, text: event.text, status: event.status ?? null, at: event.at ?? node.temporal.recorded_at });
        if (event.status !== 'completed' && event.status !== 'resolved' && event.status !== 'stale') this.current_by_topic.set(`${event.kind}:${topic}`, node.id);
        const target = event.kind === 'decision' ? this.decision_nodes
            : event.kind === 'task' ? this.task_nodes
                : event.kind === 'convention' || event.kind === 'preference' ? this.convention_nodes
                    : event.kind === 'failure' || event.kind === 'bug' ? this.failure_nodes
                        : event.kind === 'risk' ? this.risk_nodes
                            : event.kind === 'question' ? this.question_nodes
                                : event.kind === 'goal' ? this.goal_nodes
                                    : event.kind === 'constraint' || event.kind === 'requirement' ? this.constraint_nodes
                                        : event.kind === 'deployment' ? this.deployment_nodes
                                            : event.kind === 'code_fact' ? this.code_nodes
                                                : event.kind === 'skill' ? this.skill_nodes
                                                    : event.kind === 'session_turn' ? this.session_nodes
                                                        : event.kind === 'asset' ? this.asset_nodes : null;
        target?.add(node.id);
        if (event.kind === 'agent_state') this.agent = {
            last_active_task: event.topic ?? event.text,
            current_plan: Array.isArray(event.metadata?.current_plan) ? event.metadata.current_plan as string[] : [],
            pending_questions: Array.isArray(event.metadata?.pending_questions) ? event.metadata.pending_questions as string[] : [],
            files_touched: event.files_touched ?? [],
            proposed_changes: Array.isArray(event.metadata?.proposed_changes) ? event.metadata.proposed_changes as string[] : [],
            rejected_approaches: event.alternatives_rejected ?? [],
            test_results: Array.isArray(event.metadata?.test_results) ? event.metadata.test_results as string[] : [],
            known_failures: Array.isArray(event.metadata?.known_failures) ? event.metadata.known_failures as string[] : [],
            next_actions: event.next_actions ?? [],
            updated_at: node.temporal.recorded_at,
        };
    }
}