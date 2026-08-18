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
 *  file  : src/core/recall/recall_planner.ts
 *  usage : parses query intent, resolves entities, selects worlds
 */







import type { EntityResolver } from '../resolver/entity_resolver.js';
import type { HydroNode } from '../types/hydro_node.js';
import type { GateContext } from '../types/recall_mode.js';
import type { WorldGraph } from '../worlds/recursive_world.js';
import type { RecallIndex } from './candidate_selection.js';
import { tokenize } from '../i18n/multilingual_tokenizer.js';

export type RecallQuery = {
    text: string;
    now: number;

    at?: number;
    k?: number;
    token_budget?: number;

    world_id?: string;

    vector?: number[] | null;
    min_confidence?: number;

    entity_names?: string[];
    permission_context?: GateContext['permission_context'];
};

export type RecallDeps = {
    index: RecallIndex;
    world_graph?: WorldGraph;
    resolver?: EntityResolver;
    embed_query?: (text: string) => number[] | null;

    contradiction_pressure_of?: (node_id: string) => number;

    unresolved_contradiction?: (node_id: string) => boolean;

    sketch_relevance_of?: (node: HydroNode, query_terms: readonly string[]) => number;
};

export type temporal_preference = 'latest' | 'earliest' | null;

export type QueryIntent = {
    terms: string[];
    entity_names: string[];
    temporal: temporal_preference;
};

export type RecallPlan = {
    intent: QueryIntent;
    resolved_entities: string[];
    world_ids: string[] | null;
};

const capitalized_re = /\b([A-Z][a-zA-Z]+)\b/g;
const latest_re = /\b(?:latest|newest|current|currently|now|nowadays|recent|recently|these days|still|last time|most recent|up to date|updated)\b/i;
const earliest_re = /\b(?:first|firstly|originally|original|initially|initial|earliest|at the start|back then|used to)\b/i;
const non_entity_words = new Set(['what', 'when', 'where', 'which', 'who', 'whom', 'whose', 'why', 'how', 'did', 'does', 'do', 'is', 'are', 'was', 'were', 'can', 'could', 'should', 'would', 'will', 'the', 'a', 'an']);

export function parse_temporal_preference(text: string): temporal_preference {
    const latest = latest_re.test(text || '');
    const earliest = earliest_re.test(text || '');
    if (latest === earliest) return null;
    return latest ? 'latest' : 'earliest';
}

export function parse_query_intent(query: RecallQuery): QueryIntent {
    const terms = tokenize(query.text || '').map((token) => token.value);
    const parsed = ((query.text || '').match(capitalized_re) ?? []).filter((name) => !non_entity_words.has(name.toLocaleLowerCase()));
    const entity_names = [...new Set([...(query.entity_names ?? []), ...parsed])];
    return { terms, entity_names: entity_names, temporal: parse_temporal_preference(query.text) };
}

export function plan_strict_recall(query: RecallQuery, deps: RecallDeps): RecallPlan {
    const intent = parse_query_intent(query);


    const resolved_entities: string[] = [];
    for (const name of intent.entity_names) {
        const id = deps.resolver?.canonical_id_for(name);
        const entity = id ? deps.resolver?.get_entity(id) : undefined;
        resolved_entities.push(entity?.canonical_name ?? name);
    }

    let world_ids: string[] | null = null;
    if (query.world_id && deps.world_graph) {
        world_ids = deps.world_graph.query_world_subtree(query.world_id).world_ids;
    }

    return { intent, resolved_entities: resolved_entities, world_ids: world_ids };
}
