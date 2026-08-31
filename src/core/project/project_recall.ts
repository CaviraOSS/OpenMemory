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
 *  file  : src/core/project/project_recall.ts
 *  usage : implements the LongMemory project recall component
 */


import type { long_memory, public_recall_query } from '../create_memory.js';
import type { HydroEdge } from '../types/hydro_edge.js';
import type { HydroNode } from '../types/hydro_node.js';
import { code_fact_from_node, rank_code_facts, type project_code_fact } from './project_code_index.js';
import type { ProjectWorld } from './project_world.js';
import type { project_state } from './project_state.js';

export type project_recall_mode = 'project_strict' | 'project_historical' | 'project_associative' | 'project_code' | 'project_planning' | 'project_debugging';

export type project_recall_query = {
    text: string;
    now?: number;
    valid_time?: number;
    recorded_time?: number;
    k?: number;
    token_budget?: number;
};

export type project_citation = {
    memory_id: string;
    source_type: string | null;
    external_id: string | null;
    url: string | null;
    repo: string | null;
    branch: string | null;
    commit: string | null;
    file_path: string | null;
    line_start: number | null;
    line_end: number | null;
    checksum: string | null;
    version: string | null;
};

export type project_contradiction_warning = {
    edge_id: string;
    memory_a: string;
    memory_b: string;
    text_a: string | null;
    text_b: string | null;
    warning: string;
};

export type project_recalled_memory = {
    node: HydroNode;
    score: number;
    stale: boolean;
    citation: project_citation;
};

export type project_recall_result = {
    project_id: string;
    mode: project_recall_mode;
    memories: project_recalled_memory[];
    code_facts: project_code_fact[];
    contradictions: project_contradiction_warning[];
    citations: project_citation[];
    raw: unknown;
    debug_trace: Record<string, unknown>;
};

const string_or_null = (value: unknown) => typeof value === 'string' && value ? value : null;

export function citation_from_node(node: HydroNode): project_citation {
    const citation = node.metadata.citation && typeof node.metadata.citation === 'object' ? node.metadata.citation as Record<string, unknown> : {};
    const connector = node.metadata.connector_provenance && typeof node.metadata.connector_provenance === 'object' ? node.metadata.connector_provenance as Record<string, unknown> : {};
    return {
        memory_id: node.id,
        source_type: string_or_null(node.metadata.source_type ?? connector.source_type),
        external_id: string_or_null(node.metadata.external_id ?? connector.external_id),
        url: string_or_null(node.metadata.url ?? citation.url ?? connector.url ?? node.provenance.source_trace[0]?.ref),
        repo: string_or_null(node.metadata.repo ?? node.metadata.repository ?? citation.repo),
        branch: string_or_null(node.metadata.branch ?? citation.branch),
        commit: string_or_null(node.metadata.commit ?? citation.commit ?? node.metadata.source_snapshot_ref),
        file_path: string_or_null(node.metadata.file_path ?? node.metadata.path ?? citation.file_path ?? citation.path),
        line_start: typeof (node.metadata.line_start ?? citation.line_start) === 'number' ? node.metadata.line_start as number ?? citation.line_start as number : null,
        line_end: typeof (node.metadata.line_end ?? citation.line_end) === 'number' ? node.metadata.line_end as number ?? citation.line_end as number : null,
        checksum: string_or_null(node.metadata.checksum ?? connector.checksum),
        version: string_or_null(node.metadata.version ?? connector.version),
    };
}

const nodes_from_raw = (raw: any): Array<{ node: HydroNode; score: number }> => {
    if (Array.isArray(raw?.items)) return raw.items.map((item: any) => ({ node: item.node, score: Number(item.score ?? item.grounding_score ?? 0) }));
    if (Array.isArray(raw?.timeline?.entries)) return raw.timeline.entries.map((item: any) => ({ node: item.node, score: item.is_current ? 1 : 0.5 }));
    return [];
};

const mode_categories: Partial<Record<project_recall_mode, Set<string>>> = {
    project_code: new Set(['code_fact', 'connector']),
    project_planning: new Set(['architecture', 'decision', 'requirement', 'goal', 'constraint', 'task', 'risk', 'question', 'agent_state']),
    project_debugging: new Set(['bug', 'failure', 'code_fact', 'task', 'agent_state', 'connector']),
};

const stopwords = new Set(['what', 'is', 'are', 'was', 'were', 'the', 'a', 'an', 'of', 'to', 'for', 'this', 'current', 'project']);
const relevant_to = (node: HydroNode, text: string) => {
    const terms = (text.toLowerCase().match(/[a-z0-9_./-]+/g) ?? []).filter((term) => !stopwords.has(term));
    if (!terms.length) return true;
    const content = `${node.content.raw} ${node.content.summary} ${node.metadata.title ?? ''} ${node.metadata.topic ?? ''}`.toLowerCase();
    return terms.some((term) => content.includes(term));
};

const current_ref_for = (state: project_state, node: HydroNode): string | null => {
    const repo = string_or_null(node.metadata.repo ?? node.metadata.repository);
    const matching = [...state.sources.values()].find((source) => !repo || source.label === repo || source.connector_id === repo);
    return matching?.current_ref ?? null;
};

export async function collect_project_contradictions(memory: long_memory, state: project_state): Promise<project_contradiction_warning[]> {
    const explanations = await Promise.all([...state.nodes.keys()].map((id) => memory.explain(id)));
    const nodes = new Map(explanations.flatMap((item) => item.node ? [[item.node.id, item.node] as const] : []));
    const edges = new Map<string, HydroEdge>();
    for (const item of explanations) for (const edge of [...item.incoming_edges, ...item.outgoing_edges]) if (edge.type === 'contradicts') edges.set(edge.id, edge);
    return [...edges.values()].map((edge) => ({
        edge_id: edge.id,
        memory_a: edge.from,
        memory_b: edge.to,
        text_a: nodes.get(edge.from)?.content.raw ?? null,
        text_b: nodes.get(edge.to)?.content.raw ?? null,
        warning: `unresolved project contradiction between ${edge.from} and ${edge.to}`,
    }));
}

export async function recall_project_memory(memory: long_memory, project: ProjectWorld, state: project_state, query: project_recall_query, mode: project_recall_mode): Promise<project_recall_result> {
    const now = query.now ?? Date.now();
    const base: public_recall_query = {
        text: query.text,
        now,
        world_id: project.root_world_id,
        k: query.k,
        token_budget: query.token_budget,
        permission_context: { project_ids: [project.project_id] },
    };
    const core_mode = mode === 'project_historical' ? 'historical'
        : mode === 'project_associative' || mode === 'project_debugging' ? 'associative' : 'strict';
    const raw = await memory.recall({
        ...base,
        mode: core_mode,
        valid_time: query.valid_time,
        recorded_time: query.recorded_time,
    });
    const categories = mode_categories[mode];
    const raw_nodes = nodes_from_raw(raw).filter(({ node }) => {
        const kind = String(node.metadata.project_event_kind ?? (node.metadata.project_id ? 'connector' : ''));
        if (kind === 'asset') return false;
        const category_allowed = !categories || categories.has(kind) || (mode === 'project_code' && Boolean(node.facets.procedural));
        return category_allowed && (mode !== 'project_strict' || relevant_to(node, query.text));
    });
    const memories = raw_nodes.map(({ node, score }) => {
        const code = code_fact_from_node(node, current_ref_for(state, node));
        return { node, score: score * code.freshness_score, stale: code.stale, citation: citation_from_node(node) };
    }).sort((left, right) => right.score - left.score);
    const code_facts = mode === 'project_code' || mode === 'project_debugging'
        ? rank_code_facts(memories.filter((item) => item.node.facets.procedural !== null || item.node.metadata.project_event_kind === 'code_fact').map((item) => code_fact_from_node(item.node, current_ref_for(state, item.node))))
        : [];
    const contradictions = await collect_project_contradictions(memory, state);
    return {
        project_id: project.project_id,
        mode,
        memories,
        code_facts,
        contradictions,
        citations: memories.map((item) => item.citation),
        raw,
        debug_trace: {
            project_world_id: project.root_world_id,
            core_mode,
            scoped_candidates: raw_nodes.length,
            returned: memories.length,
            stale_code_facts: code_facts.filter((item) => item.stale).length,
            contradiction_count: contradictions.length,
        },
    };
}