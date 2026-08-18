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
 *  file  : src/core/engine/ingest_engine.ts
 *  usage : transactional raw-event to structured Hydrograph memory pipeline
 */

import { EdgeContext } from '../edges/edge_context.js';
import { default_edge_registry, EdgeRegistry } from '../edges/edge_registry.js';
import { insert_edge } from '../edges/edge_runtime.js';
import { create_exocortex_fact, type GroundedFact } from '../grounding/exocortex.js';
import { InMemoryWorldDB } from '../grounding/worlddb_adapter.js';
import { resolve_multilingual_entity } from '../i18n/multilingual_entity_resolver.js';
import { MemorySketches, type MemorySketchOperation } from '../math/sketches.js';
import { consolidate_memories } from '../memory/consolidation.js';
import { create_hydro_edge, create_hydro_node, DurableGraph } from '../memory/durable_graph.js';
import { WorkingMemory } from '../memory/working_memory.js';
import { InMemoryRecallIndex } from '../recall/candidate_selection.js';
import { EntityResolver, type ResolveResult } from '../resolver/entity_resolver.js';
import { default_contract, type Contract } from '../types/contract.js';
import type { HydroEdge } from '../types/hydro_edge.js';
import type { HydroNode, HydroNodeInput } from '../types/hydro_node.js';
import { default_node_state } from '../types/node_state.js';
import { manual_provenance } from '../types/provenance.js';
import type { World } from '../types/world.js';
import { WorldGraph } from '../worlds/recursive_world.js';
import { claims_conflict, extract_claims, summarize_claims, type ExtractedClaim } from './claim_extractor.js';
import { extract_facets } from './facet_extractor.js';
import { IngestTransaction } from './ingest_transaction.js';
import { parse_perception, type MemoryEvent, type ParsedPerception } from './perception_parser.js';

export type IngestTraceStep = {
    step: number;
    name: string;
    detail: string;
};

export type MemoryDiff = {
    created_node_ids: string[];
    updated_node_ids: string[];
    created_edge_ids: string[];
    resolved_entities: Array<{ mention: string; id: string; action: ResolveResult['action'] }>;
    world_ids: string[];
    worlddb_refs: string[];
    index_updates: string[];
    sketch_updates: string[];
    consolidated_node_ids: string[];
};

export type IngestResult = {
    node: HydroNode;

    changed_nodes: HydroNode[];
    nodes: HydroNode[];
    edges: HydroEdge[];
    diff: MemoryDiff;
    trace: IngestTraceStep[];
};

export type IngestEngineOptions = {
    now?: () => number;
    graph?: DurableGraph;
    resolver?: EntityResolver;
    worlds?: WorldGraph;
    worlddb?: InMemoryWorldDB;
    index?: InMemoryRecallIndex;
    sketches?: MemorySketches;
    working?: WorkingMemory;
    edge_registry?: EdgeRegistry;
    auto_consolidate?: boolean;
    working_memory_capacity?: number;
    vector_dimension?: number;
};

const result_sketch_operations = new WeakMap<IngestResult, readonly MemorySketchOperation[]>();

export function sketch_operations_for(result: IngestResult): readonly MemorySketchOperation[] {
    return result_sketch_operations.get(result) ?? [];
}

function relation_edge(type: string, from: string, to: string, at: number): HydroEdge {
    return create_hydro_edge({
        from, to, type, confidence: 0.9, weight: 1,
        temporal: { valid_from: at, valid_to: null, observed_at: at, recorded_at: at },
        handler: { handler: type, params: {} },
        provenance: manual_provenance('ingest', at),
    });
}

function latest_claim(node: HydroNode): ExtractedClaim | undefined {
    return node.content.claims?.[0] ?? extract_claims(node.content.raw)[0];
}

export class IngestEngine {
    readonly graph: DurableGraph;
    readonly resolver: EntityResolver;
    readonly worlds: WorldGraph;
    readonly worlddb: InMemoryWorldDB;
    readonly index: InMemoryRecallIndex;
    readonly sketches: MemorySketches;
    readonly working: WorkingMemory;
    readonly edge_registry: EdgeRegistry;
    readonly auto_consolidate: boolean;
    private readonly now: () => number;
    private readonly root_world_id: string;
    private readonly current_claim_nodes = new Map<string, string>();
    private readonly grounding_nodes = new Map<string, string>();
    private readonly conversation_nodes = new Map<string, HydroNode[]>();
    private relationship_graph_revision = -1;

    constructor(options: IngestEngineOptions = {}) {
        this.now = options.now ?? (() => Date.now());
        const at = this.now();
        this.graph = options.graph ?? new DurableGraph();
        this.resolver = options.resolver ?? new EntityResolver({ now: at });
        this.worlds = options.worlds ?? new WorldGraph({ now: at, dim: options.vector_dimension ?? 8 });
        this.worlddb = options.worlddb ?? new InMemoryWorldDB(this.now);
        this.index = options.index ?? new InMemoryRecallIndex([]);
        this.sketches = options.sketches ?? new MemorySketches({ vector_dimension: options.vector_dimension ?? 8 });
        this.working = options.working ?? new WorkingMemory(options.working_memory_capacity ?? 128);
        this.edge_registry = options.edge_registry ?? default_edge_registry();
        this.auto_consolidate = options.auto_consolidate ?? false;
        const existing_root = this.worlds.world_list().find((world) => world.parent_world_id === null);
        this.root_world_id = existing_root?.id ?? this.worlds.create_world({ name: 'Memory', zone: 'mixed', at }).id;
        this.rebuild_relationship_indexes();
    }

    ingest(event: MemoryEvent): IngestResult {
        const transaction = new IngestTransaction({
            graph: this.graph,
            resolver: this.resolver,
            worlds: this.worlds,
            worlddb: this.worlddb,
            index: this.index,
            sketches: this.sketches,
            working: this.working,
        }, { snapshot_sketches: false, incremental: true });
        return transaction.run(() => this.ingest_atomic(event));
    }

    private ingest_atomic(event: MemoryEvent): IngestResult {
        const trace: IngestTraceStep[] = [];
        const at = event.at ?? this.now();

        trace.push({ step: 1, name: 'accept', detail: `accepted raw event ${event.id ?? '(content-addressed)'}` });

        const working_entry = this.working.push(event, at);
        trace.push({ step: 2, name: 'working_memory', detail: `buffered sequence ${working_entry.sequence}` });

        const parsed = parse_perception(event, at);
        trace.push({ step: 3, name: 'parse', detail: `${parsed.entities.length} entities, ${parsed.claims.length} claims, zone ${parsed.zone}` });

        // Rule 1: resolution happens before node creation or durable graph write.
        const resolved = parsed.entities.map((mention) => ({ mention, result: resolve_multilingual_entity(this.resolver, mention) }));
        trace.push({ step: 4, name: 'entity_resolution', detail: resolved.map((item) => `${item.mention.name}->${item.result.entity.id}`).join(', ') || 'no entities' });

        const facets = extract_facets(parsed);
        trace.push({ step: 5, name: 'facets', detail: Object.entries(facets).filter(([, value]) => value !== null).map(([name]) => name).join(', ') });

        const world = this.select_world(parsed);
        trace.push({ step: 6, name: 'world', detail: `${world.name} (${world.id})` });

        const fact = parsed.zone === 'exocortex' ? this.create_fact(parsed) : null;
        if (fact) this.worlddb.upsert(fact);
        const grounding = this.find_grounding(parsed, fact);
        const contract = this.contract_for(parsed, world, grounding !== null);
        const draft = this.create_node(parsed, facets, world, contract, fact, grounding);
        trace.push({ step: 7, name: 'node_staged', detail: `${draft.id} created after entity resolution` });

        const staged_edges = this.relationships_for(draft, parsed, grounding);
        const context_nodes = this.auto_consolidate
            ? this.graph.node_list()
            : [...new Set(staged_edges.flatMap((edge) => [edge.from, edge.to]))]
                .flatMap((id) => this.graph.get_node(id) ?? []);
        const context = new EdgeContext({ now: at, nodes: context_nodes });
        context.add_node(draft);
        for (const edge of staged_edges) insert_edge(edge, context, this.edge_registry);
        trace.push({ step: 8, name: 'edges_executed', detail: staged_edges.map((edge) => edge.type).join(', ') || 'none' });
        trace.push({ step: 9, name: 'bitemporal_mvcc', detail: `valid ${parsed.valid_from}..${parsed.valid_to ?? 'open'}, recorded ${parsed.at}` });
        trace.push({ step: 10, name: 'grounding', detail: grounding ? `attached ${grounding.ref}` : 'no external grounding attached' });
        trace.push({ step: 11, name: 'contract', detail: `reasoning=${contract.use_for_reasoning}, requires_grounding=${contract.requires_grounding}` });

        const sketch_operations = this.sketch_operations(parsed, world, resolved, staged_edges);
        trace.push({ step: 12, name: 'indexes_and_sketches', detail: `indexed ${draft.id}; updated ${resolved.length} entity frequencies` });

        const consolidated_ids: string[] = [];
        if (this.auto_consolidate) {
            const consolidated = consolidate_memories(context.node_list(), {
                now: at,
                contradictions: context.unresolved_contradictions(),
                worlddb: this.worlddb,
            });
            for (const node of consolidated.memories) {
                context.add_node(node);
                consolidated_ids.push(node.id);
            }
            for (const edge of consolidated.edges) {
                insert_edge(edge, context, this.edge_registry);
                staged_edges.push(edge);
            }
        }
        trace.push({ step: 13, name: 'consolidation', detail: this.auto_consolidate ? `${consolidated_ids.length} derived nodes` : 'disabled' });

        const changed_nodes = context.changed_node_list();
        const created = changed_nodes.filter((node) => !this.graph.has_node(node.id)).map((node) => node.id);
        const updated = changed_nodes.filter((node) => this.graph.has_node(node.id)).map((node) => node.id);
        const created_edges = staged_edges.filter((edge) => !this.graph.get_edge(edge.id));

        // Commit only after every edge handler and optional consolidation succeeds.
        for (const node of changed_nodes) this.graph.apply_node_version(node);
        for (const edge of staged_edges) this.graph.add_edge(edge);
        for (const node of changed_nodes) this.index.add(node);
        this.worlds.add_node_to_world(world.id, draft.id);
        for (const id of consolidated_ids) this.worlds.add_node_to_world(world.id, id);
        for (const edge of staged_edges) this.worlds.add_edge_to_world(world.id, edge.id);
        this.apply_sketch_operations(sketch_operations);
        for (const node of changed_nodes) this.register_relationship_node(node);
        this.relationship_graph_revision = this.graph.revision;

        const committed = this.graph.get_node(draft.id) as HydroNode;
        const diff: MemoryDiff = {
            created_node_ids: created,
            updated_node_ids: updated,
            created_edge_ids: created_edges.map((edge) => edge.id),
            resolved_entities: resolved.map((item) => ({ mention: item.mention.name, id: item.result.entity.id, action: item.result.action })),
            world_ids: [world.id],
            worlddb_refs: fact ? [fact.ref] : grounding ? [grounding.ref] : [],
            index_updates: [...new Set([...created, ...updated])],
            sketch_updates: [
                ...resolved.map((item) => `entities:${item.result.entity.id}`),
                ...(parsed.event.tags ?? []).map((tag) => `tags:${tag}`),
                ...staged_edges.map((edge) => `relations:${edge.type}`),
                `worlds:${world.id}`,
                ...parsed.claims.map((claim) => `patterns:${claim.topic}`),
            ],
            consolidated_node_ids: consolidated_ids,
        };
        trace.push({ step: 14, name: 'memory_diff', detail: `${created.length} created, ${updated.length} updated, ${created_edges.length} edges` });
        const created_set = new Set(created);
        const result: IngestResult = {
            node: committed,
            changed_nodes,
            nodes: changed_nodes.filter((node) => created_set.has(node.id)),
            edges: created_edges,
            diff,
            trace,
        };
        result_sketch_operations.set(result, sketch_operations);
        return result;
    }

    private select_world(parsed: ParsedPerception): World {
        if (parsed.event.world_id) {
            const selected = this.worlds.get_world(parsed.event.world_id);
            if (!selected) throw new Error(`unknown world: ${parsed.event.world_id}`);
            return selected;
        }
        const name = parsed.event.world ?? `${parsed.event.user_id}:${parsed.zone}`;
        const existing = this.worlds.get_world_by_name(name);
        return existing ?? this.worlds.create_child_world(this.root_world_id, {
            name,
            zone: parsed.zone,
            at: parsed.at,
        }, { defer_hash: true });
    }

    private create_fact(parsed: ParsedPerception): GroundedFact {
        const source = parsed.event.source ?? { id: 'manual-external', kind: 'manual' as const, reliability: 0.7 };
        return create_exocortex_fact({
            ref: parsed.event.grounding_ref,
            statement: parsed.text,
            source,
            vector: parsed.event.vector ?? null,
            observed_at: parsed.observed_at,
            valid_from: parsed.valid_from,
            valid_to: parsed.valid_to,
            metadata: { ...parsed.event.metadata, user_id: parsed.event.user_id },
        });
    }

    private find_grounding(parsed: ParsedPerception, fact: GroundedFact | null): GroundedFact | null {
        if (fact) return fact;
        if (parsed.event.grounding_ref) return this.worlddb.get(parsed.event.grounding_ref);
        return this.worlddb.search(parsed.text)[0] ?? null;
    }

    private contract_for(parsed: ParsedPerception, world: World, grounded: boolean): Contract {
        const inherited = this.worlds.resolve_contracts(world.id);
        const factual = parsed.claims.some((claim) => claim.kind === 'fact');
        return {
            ...default_contract(),
            ...inherited,
            requires_grounding: parsed.zone === 'endocortex' && factual ? true : inherited.requires_grounding,
            source_required: parsed.zone === 'exocortex' || grounded || inherited.source_required,
            ...parsed.event.contract,
        };
    }

    private create_node(
        parsed: ParsedPerception,
        facets: HydroNodeInput['facets'],
        world: World,
        contract: Contract,
        fact: GroundedFact | null,
        grounding: GroundedFact | null,
    ): HydroNode {
        const input: HydroNodeInput = {
            id: parsed.event.id ?? fact?.ref,
            content: {
                raw: parsed.multilingual.original_text,
                canonical: parsed.multilingual.normalization.canonical_text,
                summary: summarize_claims(parsed.claims) || parsed.multilingual.normalization.canonical_text,
                claims: parsed.claims,
                language: parsed.multilingual.language,
                script: parsed.multilingual.script.script,
                direction: parsed.multilingual.script.direction,
                original_text: parsed.multilingual.original_text,
                canonical_text: parsed.multilingual.normalization.canonical_text,
                translated_text: parsed.multilingual.translated_text,
                transliteration: parsed.multilingual.transliteration,
                locale: parsed.multilingual.locale,
                code_switch_segments: parsed.multilingual.code_switch_segments,
                language_confidence: parsed.multilingual.language_confidence,
                translation_provenance: parsed.multilingual.translation_provenance,
            },
            facets,
            world: {
                world_id: world.id,
                parent_world_id: world.parent_world_id,
                zone: parsed.zone,
                scope_path: world.scope_path,
            },
            temporal: {
                valid_from: parsed.valid_from,
                valid_to: parsed.valid_to,
                observed_at: parsed.observed_at,
                recorded_at: parsed.at,
                superseded_at: null,
            },
            contract,
            grounding: {
                worlddb_ref: grounding?.ref ?? null,
                source_ids: grounding ? [grounding.source.id] : [],
                grounding_score: grounding?.source.reliability ?? 0,
            },
            state: default_node_state(),
            vectors: { semantic: parsed.event.vector ?? null, type_vector: null, world_vector: world.world_vector },
            provenance: manual_provenance(parsed.event.source?.id ?? parsed.event.user_id, parsed.observed_at),
            metadata: { ...(parsed.event.metadata ?? {}), ...(parsed.event.conversation_id ? { conversation_id: parsed.event.conversation_id } : {}) },
        };
        return create_hydro_node(input);
    }

    private relationships_for(
        draft: HydroNode,
        parsed: ParsedPerception,
        grounding: GroundedFact | null,
    ): HydroEdge[] {
        this.ensure_relationship_indexes();
        const edges: HydroEdge[] = [];
        const incoming = parsed.claims[0];
        const behavior = parsed.event.conflict_behavior ?? 'auto';
        if (incoming && behavior !== 'none') {
            const related_id = this.current_claim_nodes.get(incoming.topic);
            const related_node = related_id ? this.graph.get_node(related_id) : undefined;
            const related_claim = related_node ? latest_claim(related_node) : undefined;
            if (related_node && related_claim && related_node.state.status === 'active' && related_node.temporal.superseded_at === null && claims_conflict(incoming, related_claim)) {
                const type = behavior === 'supersede' ? 'supersedes'
                    : behavior === 'contradict' ? 'contradicts'
                        : incoming.kind === 'preference' || parsed.zone === 'exocortex' ? 'supersedes' : 'contradicts';
                edges.push(relation_edge(type, draft.id, related_node.id, parsed.at));
            }
        }
        if (parsed.zone === 'endocortex' && grounding) {
            const target_id = this.grounding_nodes.get(grounding.ref);
            const target = target_id ? this.graph.get_node(target_id) : undefined;
            if (target) edges.push(relation_edge('grounds', draft.id, target.id, parsed.at));
        }
        const conversation_id = parsed.event.conversation_id;
        if (conversation_id) {
            const previous = this.previous_conversation_node(conversation_id, parsed.observed_at);
            if (previous) edges.push(relation_edge('refers_to', draft.id, previous.id, parsed.at));
        }
        return edges;
    }

    private register_relationship_node(node: HydroNode): void {
        const claim = latest_claim(node);
        if (claim && node.state.status === 'active' && node.temporal.superseded_at === null) {
            const prior_id = this.current_claim_nodes.get(claim.topic);
            const prior = prior_id ? this.graph.get_node(prior_id) : undefined;
            if (!prior || prior.temporal.observed_at <= node.temporal.observed_at) this.current_claim_nodes.set(claim.topic, node.id);
        }
        if (node.world.zone === 'exocortex' && node.grounding.worlddb_ref) this.grounding_nodes.set(node.grounding.worlddb_ref, node.id);
        const conversation_id = typeof node.metadata.conversation_id === 'string' ? node.metadata.conversation_id : '';
        if (!conversation_id) return;
        const values = this.conversation_nodes.get(conversation_id) ?? [];
        const existing = values.findIndex((item) => item.id === node.id);
        if (existing >= 0) values.splice(existing, 1);
        let low = 0;
        let high = values.length;
        while (low < high) {
            const middle = (low + high) >>> 1;
            if (values[middle].temporal.observed_at <= node.temporal.observed_at) low = middle + 1;
            else high = middle;
        }
        values.splice(low, 0, node);
        this.conversation_nodes.set(conversation_id, values);
    }

    private previous_conversation_node(conversation_id: string, observed_at: number): HydroNode | undefined {
        const values = this.conversation_nodes.get(conversation_id) ?? [];
        let low = 0;
        let high = values.length;
        while (low < high) {
            const middle = (low + high) >>> 1;
            if (values[middle].temporal.observed_at <= observed_at) low = middle + 1;
            else high = middle;
        }
        return low > 0 ? values[low - 1] : undefined;
    }

    private ensure_relationship_indexes(): void {
        if (this.relationship_graph_revision !== this.graph.revision) this.rebuild_relationship_indexes();
    }

    private rebuild_relationship_indexes(): void {
        this.current_claim_nodes.clear();
        this.grounding_nodes.clear();
        this.conversation_nodes.clear();
        for (const node of this.graph.node_list().sort((left, right) => left.temporal.observed_at - right.temporal.observed_at)) {
            this.register_relationship_node(node);
        }
        this.relationship_graph_revision = this.graph.revision;
    }

    private sketch_operations(
        parsed: ParsedPerception,
        world: World,
        resolved: Array<{ mention: ParsedPerception['entities'][number]; result: ResolveResult }>,
        edges: readonly HydroEdge[],
    ): MemorySketchOperation[] {
        const operations: MemorySketchOperation[] = [
            ...resolved.map((item): MemorySketchOperation => ({ type: 'frequency', domain: 'entities', key: item.result.entity.id })),
            ...(parsed.event.tags ?? []).map((tag): MemorySketchOperation => ({ type: 'frequency', domain: 'tags', key: tag })),
            ...edges.map((edge): MemorySketchOperation => ({ type: 'frequency', domain: 'relations', key: edge.type })),
            ...parsed.claims.map((claim): MemorySketchOperation => ({ type: 'frequency', domain: 'patterns', key: claim.topic })),
            { type: 'frequency', domain: 'worlds', key: world.id },
        ];
        const vector = parsed.event.vector;
        if (vector && vector.length === this.sketches.options.vector_dimension) {
            if (!vector.every(Number.isFinite)) throw new Error('event vector must contain finite values');
            operations.push({ type: 'world', id: world.id, vector });
            operations.push(...resolved.map((item): MemorySketchOperation => ({ type: 'drift', id: item.result.entity.id, vector })));
        }
        return operations;
    }

    private apply_sketch_operations(operations: readonly MemorySketchOperation[]): void {
        for (const operation of operations) this.sketches.apply_operation(operation);
    }
}