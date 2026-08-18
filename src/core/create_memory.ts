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
 *  file  : src/core/create_memory.ts
 *  usage : public openmemory package facade
 */

import { IngestEngine, IngestTransaction, type IngestResult, type MemoryEvent } from './engine/index.js';
import { EdgeContext } from './edges/edge_context.js';
import { insert_edge } from './edges/edge_runtime.js';
import { hydrograph_invariants } from './invariants.js';
import { MemorySketches } from './math/sketches.js';
import { create_hydro_edge, DurableGraph } from './memory/durable_graph.js';
import { InMemoryRecallIndex } from './recall/candidate_selection.js';
import { associative_recall, type AssociativeRecallResult } from './recall/associative_recall.js';
import { grounded_recall, type GroundedRecallResult } from './recall/grounded_recall.js';
import { historical_recall, type HistoricalRecallResult } from './recall/historical_recall.js';
import { strict_recall, type StrictRecallResult } from './recall/strict_recall.js';
import type { Entity, EntityMention } from './types/entity.js';
import type { HydroEdge } from './types/hydro_edge.js';
import type { HydroNode } from './types/hydro_node.js';
import type { GateContext } from './types/recall_mode.js';
import type { World } from './types/world.js';
import { manual_provenance } from './types/provenance.js';
import type { HydrographImportPlan, hydrograph_import_result, planned_edge } from './connectors/source_event.js';
import { permission_contract } from './connectors/permission.js';
import { EntityResolver } from './resolver/entity_resolver.js';
import { WorldGraph } from './worlds/recursive_world.js';
import { InMemoryWorldDB } from './grounding/worlddb_adapter.js';
import { SqliteStore } from '../stores/sqlite/sqlite_store.js';
import { resolve_multilingual_entity } from './i18n/multilingual_entity_resolver.js';
import { format_crosslingual_recall, type crosslingual_recall_query, type crosslingual_recall_result, type translation_provider } from './i18n/crosslingual_recall.js';
import { detect_language, type language_code } from './i18n/language_detection.js';
import { deterministic_multilingual_embeddings, type multilingual_embedding_provider } from './i18n/multilingual_embeddings.js';
import { sha256_hex } from './hash/content_hash.js';
import type { embedding_context } from './embeddings/types.js';

export type memory_store_kind = 'memory' | 'sqlite';
export type recall_mode = 'strict' | 'historical' | 'associative' | 'world_grounded';
export type memory_event = MemoryEvent;
export type ingest_result = IngestResult;

export type embedding_provider = {
    embed(text: string, context?: embedding_context): number[] | Promise<number[]>;
};

export type memory_config = {
    store?: memory_store_kind;
    db_path?: string;
    readonly?: boolean;
    embedding_provider?: embedding_provider | ((text: string) => number[] | Promise<number[]>);
    embedding_dimension?: number;
    embedding_cache_size?: number;
    default_world?: string;
    max_context_tokens?: number;
    strict_confidence_threshold?: number;
    grounding_threshold?: number;
    enable_cold_log?: boolean;
    enable_consolidation?: boolean;
    benchmark_mode?: boolean;
    tenant_id?: string;
    user_id?: string;
    default_language?: language_code;
    output_language?: language_code;
    preserve_original_text?: boolean;
    enable_translation?: boolean;
    translation_provider?: translation_provider;
    enable_transliteration?: boolean;
    multilingual_embedding_provider?: multilingual_embedding_provider;
    fallback_language?: language_code;
};

export type public_recall_query = {
    text: string;
    mode?: recall_mode;
    now?: number;
    at?: number;
    valid_time?: number;
    recorded_time?: number;
    world_id?: string;
    entity_names?: string[];
    vector?: number[] | null;
    k?: number;
    token_budget?: number;
    min_confidence?: number;
    min_freshness?: number;
    min_source_reliability?: number;
    grounding_threshold?: number;
    permission_context?: GateContext['permission_context'];
};

export type memory_explanation = {
    id: string;
    node: HydroNode | null;
    incoming_edges: HydroEdge[];
    outgoing_edges: HydroEdge[];
    ingest: IngestResult | null;
};

export type world_list_params = {
    parent_world_id?: string | null;
    zone?: World['zone'];
    limit?: number;
};

export type timeline_params = {
    text?: string;
    now?: number;
    valid_time?: number;
    recorded_time?: number;
    world_id?: string;
    entity_names?: string[];
};

export type memory_stats = {
    store: memory_store_kind;
    nodes: number;
    edges: number;
    worlds: number;
    entities: number;
    grounded_facts: number;
    working_memory: number;
    cold_log_enabled: boolean;
    consolidation_enabled: boolean;
    closed: boolean;
};

export interface open_memory {
    ingest(event: MemoryEvent): Promise<IngestResult>;
    recall(query: public_recall_query): Promise<StrictRecallResult | HistoricalRecallResult | AssociativeRecallResult | GroundedRecallResult>;
    explain(id: string): Promise<memory_explanation>;
    getWorld(id: string): Promise<World | null>;
    listWorlds(params?: world_list_params): Promise<World[]>;
    getEntity(id: string): Promise<Entity | null>;
    resolveEntity(input: EntityMention): Promise<ReturnType<IngestEngine['resolver']['resolve']>>;
    getTimeline(params?: timeline_params): Promise<HistoricalRecallResult>;
    getStats(): Promise<memory_stats>;
    recallMultilingual(query: crosslingual_recall_query): Promise<crosslingual_recall_result>;
    applyImportPlan(plan: HydrographImportPlan): Promise<hydrograph_import_result>;
    close(): Promise<void>;
    status(): { name: 'openmemory-hydrograph'; phase: 'phase-19-public-api'; ready: boolean; store: memory_store_kind };
    invariants(): readonly string[];
}

const defaults: Required<Pick<memory_config,
    'store' | 'db_path' | 'default_world' | 'max_context_tokens' |
    'strict_confidence_threshold' | 'grounding_threshold' | 'enable_cold_log' | 'embedding_dimension' | 'embedding_cache_size' |
    'enable_consolidation' | 'benchmark_mode' | 'tenant_id' | 'user_id'
    | 'default_language' | 'preserve_original_text' | 'enable_translation' | 'enable_transliteration' | 'fallback_language'
>> = {
    store: 'memory',
    db_path: './openmemory.db',
    default_world: 'memory',
    max_context_tokens: 2048,
    strict_confidence_threshold: 0.5,
    grounding_threshold: 0.6,
    enable_cold_log: false,
    enable_consolidation: false,
    benchmark_mode: false,
    tenant_id: 'default',
    user_id: 'default',
    embedding_dimension: 8,
    embedding_cache_size: 2_048,
    default_language: 'en',
    preserve_original_text: true,
    enable_translation: false,
    enable_transliteration: true,
    fallback_language: 'en',
};

class bounded_embedding_cache {
    private readonly values = new Map<string, Promise<number[] | null>>();

    constructor(private readonly capacity: number) { }

    async get(key: string, load: () => number[] | null | Promise<number[] | null>): Promise<number[] | null> {
        if (this.capacity === 0) return load();
        const cached = this.values.get(key);
        if (cached) {
            this.values.delete(key);
            this.values.set(key, cached);
            const vector = await cached;
            return vector ? [...vector] : null;
        }
        const pending = Promise.resolve(load()).then((vector) => vector ? [...vector] : null);
        this.values.set(key, pending);
        while (this.values.size > this.capacity) this.values.delete(this.values.keys().next().value as string);
        try {
            const vector = await pending;
            return vector ? [...vector] : null;
        } catch (error) {
            if (this.values.get(key) === pending) this.values.delete(key);
            throw error;
        }
    }
}

const embed = async (
    provider: memory_config['embedding_provider'],
    multilingual: multilingual_embedding_provider,
    cache: bounded_embedding_cache,
    text: string,
    language: language_code,
    purpose: embedding_context['purpose'],
): Promise<number[] | null> => cache.get(`${purpose ?? 'document'}:${language}:${sha256_hex(text)}`, async () => {
    if (provider) return typeof provider === 'function' ? provider(text) : provider.embed(text, { language, purpose });
    return multilingual.embed(text, language);
});

export function create_memory(config: memory_config = {}): open_memory {
    const cfg = { ...defaults, ...config };
    if (!Number.isInteger(cfg.embedding_cache_size) || cfg.embedding_cache_size < 0) throw new Error('embedding_cache_size must be a non-negative integer');
    const multilingual_embeddings = config.multilingual_embedding_provider ?? new deterministic_multilingual_embeddings(cfg.embedding_dimension);
    const embedding_cache = new bounded_embedding_cache(cfg.embedding_cache_size);
    let store: SqliteStore | null = null;
    if (cfg.store === 'sqlite') {
        store = new SqliteStore(cfg.db_path, {
            tenant_id: cfg.tenant_id,
            user_id: cfg.user_id,
            readonly: config.readonly ?? false,
            file_must_exist: config.readonly ?? false,
            startup_integrity_check: true,
        });
    }

    const recovered_nodes = store?.load_nodes() ?? [];
    const recovered_edges = store?.load_edges() ?? [];
    const recovered_worlds = store?.load_worlds() ?? [];
    const graph = new DurableGraph();
    const index = new InMemoryRecallIndex([]);
    const resolver = new EntityResolver();
    const worlddb = new InMemoryWorldDB();
    const recovered_sketches = store?.load_sketch_state('global');
    const sketches = recovered_sketches?.options.vector_dimension === cfg.embedding_dimension
        ? recovered_sketches
        : new MemorySketches({ vector_dimension: cfg.embedding_dimension });
    if (store && !recovered_sketches && config.readonly !== true) store.save_sketch_state('global', sketches);
    const worlds = new WorldGraph({ dim: sketches.options.vector_dimension });
    for (const node of recovered_nodes) {
        graph.apply_node_version(node);
        index.add(node);
    }
    for (const edge of recovered_edges) graph.add_edge(edge);
    for (const entity of store?.load_entities() ?? []) resolver.register_entity(entity);
    for (const fact of store?.load_grounded_facts() ?? []) worlddb.upsert(fact);
    if (recovered_worlds.length > 0) {
        worlds.restore({
            worlds: new Map(recovered_worlds.map((world) => [world.id, world])),
            primary_world_of: new Map(recovered_nodes.map((node) => [node.id, node.world.world_id])),
            placement_history: recovered_nodes.map((node) => ({
                node_id: node.id,
                from_world_id: null,
                to_world_id: node.world.world_id,
                at: node.temporal.recorded_at,
            })),
        });
    }
    const engine = new IngestEngine({
        graph,
        index,
        resolver,
        worlds,
        worlddb,
        sketches,
        auto_consolidate: cfg.enable_consolidation,
    });

    const traces = new Map<string, IngestResult>();
    let closed = false;
    const ensure_open = () => {
        if (closed) throw new Error('openmemory instance is closed');
    };
    const deps = () => ({
        index: engine.index,
        world_graph: engine.worlds,
        resolver: engine.resolver,
        contradiction_pressure_of: (id: string) => engine.graph.get_node(id)?.state.status === 'contradicted' ? 1 : 0,
        unresolved_contradiction: (id: string) => engine.graph.get_node(id)?.state.status === 'contradicted',
        sketch_relevance_of: (_node: HydroNode, terms: readonly string[]) => engine.sketches.relevance('patterns', terms),
    });

    const import_transaction = () => new IngestTransaction({
        graph: engine.graph,
        resolver: engine.resolver,
        worlds: engine.worlds,
        worlddb: engine.worlddb,
        index: engine.index,
        sketches: engine.sketches,
        working: engine.working,
    });

    const import_edge = (edge: planned_edge, node_ids: Map<string, string>, context: EdgeContext) => {
        const from = node_ids.get(edge.from) ?? edge.from;
        const to = node_ids.get(edge.to) ?? edge.to;
        const hydro_edge = create_hydro_edge({
            from,
            to,
            type: edge.type,
            confidence: edge.confidence,
            weight: edge.weight,
            temporal: {
                valid_from: edge.valid_from,
                valid_to: edge.valid_to,
                observed_at: edge.observed_at,
                recorded_at: edge.recorded_at,
            },
            handler: { handler: edge.type, params: { connector_edge_key: edge.key, ...edge.metadata } },
            provenance: manual_provenance(`connector:${edge.key}`, edge.recorded_at),
        });
        insert_edge(hydro_edge, context, engine.edge_registry);
        return hydro_edge;
    };

    const api: open_memory = {
        async ingest(event) {
            ensure_open();
            const language = event.language ?? detect_language(event.text).language ?? cfg.default_language;
            let translated_text = event.translated_text ?? null;
            let translation_provenance = event.translation_provenance ?? null;
            const translation_target = cfg.output_language;
            const translation_allowed = event.contract?.translation_allowed !== false && event.contract?.preserve_exact_language !== true;
            if (!translated_text && cfg.enable_translation && cfg.translation_provider && translation_target && translation_target !== language && translation_allowed) {
                const translated = await cfg.translation_provider.translate(event.text, language, translation_target);
                translated_text = translated.text;
                translation_provenance = {
                    provider: translated.provider ?? cfg.translation_provider.name ?? 'translation-provider',
                    target_language: translation_target,
                    confidence: translated.confidence,
                    derived_at: event.at ?? Date.now(),
                    source_text_hash: sha256_hex(event.text),
                };
            }
            const vector = event.vector ?? await embed(cfg.embedding_provider, multilingual_embeddings, embedding_cache, event.text, language, 'document');
            const result = engine.ingest({
                ...event,
                world: event.world ?? cfg.default_world,
                vector,
                language,
                locale: event.locale,
                translated_text,
                translation_provenance,
                enable_transliteration: cfg.enable_transliteration,
            });
            for (const node of result.changed_nodes) traces.set(node.id, result);
            if (store) {
                store.transaction(() => {
                    store.persist_ingest(result);
                    const worlds = new Map(result.diff.world_ids
                        .flatMap((world_id) => engine.worlds.get_world_path(world_id))
                        .map((world) => [world.id, world]));
                    for (const world of worlds.values()) store.save_world(world, false);
                    for (const node_id of result.diff.created_node_ids) {
                        const node = engine.graph.get_node(node_id);
                        if (node) store.add_world_node_ref(node.world.world_id, node.id);
                    }
                    for (const edge of result.edges) {
                        const source = engine.graph.get_node(edge.from);
                        if (source) store.add_world_edge_ref(source.world.world_id, edge.id);
                    }
                    for (const entity_id of new Set(result.diff.resolved_entities.map((item) => item.id))) {
                        const entity = engine.resolver.get_entity(entity_id);
                        if (entity) store.save_entity(entity);
                    }
                    for (const ref of new Set(result.diff.worlddb_refs)) {
                        const fact = engine.worlddb.get(ref);
                        if (fact) store.save_grounded_fact(fact);
                    }
                    if (cfg.enable_cold_log) store.append_cold_log(event, event.id, event.at);
                });
            }
            return result;
        },
        async recall(query) {
            ensure_open();
            const now = query.now ?? Date.now();
            const mode = query.mode ?? 'strict';
            if (mode === 'historical') {
                return historical_recall({
                    text: query.text,
                    now,
                    valid_time: query.valid_time ?? query.at,
                    recorded_time: query.recorded_time,
                    world_id: query.world_id,
                    entity_names: query.entity_names,
                    permission_context: query.permission_context,
                }, { ...deps(), supersedes_edges: engine.graph.edge_list() });
            }
            if (mode === 'world_grounded') {
                return grounded_recall({
                    text: query.text, now, world_id: query.world_id,
                    entity_names: query.entity_names, k: query.k,
                    token_budget: query.token_budget ?? cfg.max_context_tokens,
                    min_freshness: query.min_freshness,
                    min_source_reliability: query.min_source_reliability,
                    grounding_threshold: query.grounding_threshold ?? cfg.grounding_threshold,
                    permission_context: query.permission_context,
                }, { ...deps(), worlddb: engine.worlddb, grounds_edges: engine.graph.edge_list() });
            }
            const query_language = detect_language(query.text).language;
            const vector = query.vector ?? await embed(cfg.embedding_provider, multilingual_embeddings, embedding_cache, query.text, query_language, 'query');
            if (mode === 'associative') {
                return associative_recall({
                    text: query.text, now, at: query.at, world_id: query.world_id,
                    entity_names: query.entity_names, vector, k: query.k,
                    token_budget: query.token_budget ?? cfg.max_context_tokens,
                    min_confidence: query.min_confidence,
                    permission_context: query.permission_context,
                }, { ...deps(), edges: engine.graph.edge_list() });
            }
            return strict_recall({
                text: query.text, now, at: query.at, world_id: query.world_id,
                entity_names: query.entity_names, vector, k: query.k,
                token_budget: query.token_budget ?? cfg.max_context_tokens,
                min_confidence: query.min_confidence ?? cfg.strict_confidence_threshold,
                permission_context: query.permission_context,
            }, deps());
        },
        async explain(id) {
            ensure_open();
            const edges = engine.graph.edge_list();
            return {
                id,
                node: engine.graph.get_node(id) ?? store?.load_node(id) ?? null,
                incoming_edges: edges.filter((edge) => edge.to === id),
                outgoing_edges: edges.filter((edge) => edge.from === id),
                ingest: traces.get(id) ?? null,
            };
        },
        async getWorld(id) {
            ensure_open();
            return engine.worlds.get_world(id) ?? null;
        },
        async listWorlds(params = {}) {
            ensure_open();
            return engine.worlds.world_list()
                .filter((world) => params.parent_world_id === undefined || world.parent_world_id === params.parent_world_id)
                .filter((world) => params.zone === undefined || world.zone === params.zone)
                .sort((left, right) => left.scope_path.join('/').localeCompare(right.scope_path.join('/')))
                .slice(0, params.limit ?? Number.POSITIVE_INFINITY);
        },
        async getEntity(id) {
            ensure_open();
            return engine.resolver.get_entity(id) ?? null;
        },
        async resolveEntity(input) {
            ensure_open();
            const result = resolve_multilingual_entity(engine.resolver, input);
            if (store) store.save_entity(result.entity);
            return result;
        },
        async getTimeline(params = {}) {
            ensure_open();
            return historical_recall({
                text: params.text ?? '',
                now: params.now ?? Date.now(),
                valid_time: params.valid_time,
                recorded_time: params.recorded_time,
                world_id: params.world_id,
                entity_names: params.entity_names,
            }, { ...deps(), supersedes_edges: engine.graph.edge_list() });
        },
        async getStats() {
            return {
                store: cfg.store,
                nodes: engine.graph.node_count(),
                edges: engine.graph.edge_count(),
                worlds: engine.worlds.world_list().length,
                entities: engine.resolver.entity_list().length,
                grounded_facts: engine.graph.node_list().filter((node) => node.world.zone === 'exocortex').length,
                working_memory: engine.working.size,
                cold_log_enabled: cfg.enable_cold_log,
                consolidation_enabled: cfg.enable_consolidation,
                closed,
            };
        },
        async recallMultilingual(query) {
            ensure_open();
            const query_language = detect_language(query.text).language;
            const output_language = query.output_language ?? cfg.output_language ?? query_language ?? cfg.fallback_language;
            const result = await api.recall(query);
            return format_crosslingual_recall(result, query, {
                query_language,
                output_language,
                translation_provider: cfg.translation_provider,
                enable_translation: query.enable_translation ?? cfg.enable_translation,
            });
        },
        async applyImportPlan(plan) {
            ensure_open();
            if (!plan.connector_id || !plan.source_type || !plan.sync_item_id) throw new Error('connector plan identity is required');
            for (const node of plan.nodes_to_create) {
                if (!node.source_type || !node.external_id || !node.recorded_at || !node.provenance) {
                    throw new Error(`connector node ${node.key} is missing source identity, recorded_at, or provenance`);
                }
            }
            return import_transaction().run(() => {
                const before_nodes = new Set(engine.graph.node_list().map((node) => node.id));
                const before_edges = new Set(engine.graph.edge_list().map((edge) => edge.id));
                const before_worlds = new Set(engine.worlds.world_list().map((world) => world.id));
                const before_entities = new Set(engine.resolver.entity_list().map((entity) => entity.id));
                const nodes_to_persist = new Map<string, HydroNode>();
                const edges_to_persist = new Map<string, HydroEdge>();
                const touched_world_ids = new Set<string>();
                const touched_entity_ids = new Set<string>();
                const touched_fact_refs = new Set<string>();
                const created_node_ids = new Set<string>();
                const created_edge_ids = new Set<string>();
                const touch_world_path = (world_id: string) => {
                    for (const world of engine.worlds.get_world_path(world_id)) touched_world_ids.add(world.id);
                };
                const collect_ingest = (result: IngestResult) => {
                    for (const node of result.changed_nodes) nodes_to_persist.set(node.id, node);
                    for (const edge of result.edges) edges_to_persist.set(edge.id, edge);
                    for (const id of result.diff.created_node_ids) created_node_ids.add(id);
                    for (const id of result.diff.created_edge_ids) created_edge_ids.add(id);
                    for (const id of result.diff.world_ids) touch_world_path(id);
                    for (const entity of result.diff.resolved_entities) touched_entity_ids.add(entity.id);
                    for (const ref of result.diff.worlddb_refs) touched_fact_refs.add(ref);
                };
                const root = engine.worlds.world_list().find((world) => world.parent_world_id === null);
                if (!root) throw new Error('connector import requires a root world');
                const world_ids = new Map<string, string>();
                const pending_worlds = [...plan.worlds_to_create];
                while (pending_worlds.length) {
                    const next = pending_worlds.findIndex((world) => world.parent_key === null || world_ids.has(world.parent_key));
                    if (next < 0) throw new Error('connector plan has an unresolved or cyclic world parent');
                    const world = pending_worlds.splice(next, 1)[0];
                    const existing = engine.worlds.world_list().find((item) =>
                        item.metadata.connector_id === plan.connector_id && item.metadata.connector_key === world.key);
                    const parent_id = world.parent_key
                        ? world_ids.get(world.parent_key) as string
                        : world.parent_world_id ?? root.id;
                    if (!engine.worlds.get_world(parent_id)) throw new Error(`connector world ${world.key} references unknown parent ${parent_id}`);
                    const created = existing ?? engine.worlds.create_child_world(parent_id, {
                        name: world.name,
                        zone: world.zone,
                        contracts: world.contracts,
                        metadata: { ...world.metadata, connector_id: plan.connector_id, connector_key: world.key },
                        at: world.created_at,
                    });
                    world_ids.set(world.key, created.id);
                    if (!existing) touch_world_path(created.id);
                }
                for (const mention of plan.entities_to_resolve) {
                    const resolved = engine.resolver.resolve(mention);
                    touched_entity_ids.add(resolved.entity.id);
                }
                const node_ids = new Map<string, string>();
                for (const node of plan.nodes_to_create) {
                    const world_id = world_ids.get(node.world_key) ?? engine.worlds.world_list().find((world) =>
                        world.metadata.connector_id === plan.connector_id && world.metadata.connector_key === node.world_key)?.id;
                    if (!world_id) throw new Error(`connector node ${node.key} references unknown world ${node.world_key}`);
                    const result = engine.ingest({
                        id: node.id,
                        user_id: cfg.user_id,
                        text: node.content,
                        at: node.recorded_at,
                        observed_at: node.observed_at,
                        valid_from: node.valid_from,
                        valid_to: node.valid_to,
                        world_id,
                        facet_hint: node.facet,
                        external: node.zone === 'exocortex',
                        source: node.zone === 'exocortex' ? node.grounding_source : undefined,
                        grounding_ref: node.zone === 'exocortex' ? `connector:${plan.connector_id}:${node.external_id}:${node.checksum}` : undefined,
                        entity_hints: node.entities,
                        contract: {
                            source_required: node.zone === 'exocortex',
                            expires_if_unconfirmed: node.zone === 'exocortex',
                            ...permission_contract(node.permission),
                            ...node.contract,
                        },
                        metadata: {
                            ...node.metadata,
                            connector_id: plan.connector_id,
                            source_type: node.source_type,
                            external_id: node.external_id,
                            title: node.title,
                            url: node.url,
                            version: node.version,
                            checksum: node.checksum,
                            timestamp_seconds: node.timestamp_seconds,
                            connector_provenance: node.provenance,
                        },
                        conflict_behavior: node.conflict_behavior ?? 'auto',
                    });
                    traces.set(result.node.id, result);
                    collect_ingest(result);
                    node_ids.set(node.key, result.node.id);
                }
                const endpoint_ids = new Set<string>();
                for (const edge of plan.edges_to_create) {
                    endpoint_ids.add(node_ids.get(edge.from) ?? edge.from);
                    endpoint_ids.add(node_ids.get(edge.to) ?? edge.to);
                }
                for (const action of plan.deletion_or_supersession_actions) {
                    endpoint_ids.add(action.target_node_id);
                    if (action.replacement_node_key) endpoint_ids.add(node_ids.get(action.replacement_node_key) ?? action.replacement_node_key);
                }
                const edge_context = new EdgeContext({
                    now: plan.recorded_at,
                    nodes: [...endpoint_ids].flatMap((id) => engine.graph.get_node(id) ?? []),
                });
                const explicit_edges = plan.edges_to_create.map((edge) => import_edge(edge, node_ids, edge_context));
                const deletion_replacements = new Map<string, string>();
                for (const action of plan.deletion_or_supersession_actions) {
                    let replacement = action.replacement_node_key ? node_ids.get(action.replacement_node_key) : undefined;
                    if (!replacement && action.type === 'source_deleted') {
                        replacement = deletion_replacements.get(action.external_id);
                    }
                    if (!replacement && action.type === 'source_deleted') {
                        const target = engine.graph.get_node(action.target_node_id);
                        if (!target) throw new Error(`connector deletion target not found: ${action.target_node_id}`);
                        const tombstone = engine.ingest({
                            id: `connector-deleted:${plan.connector_id}:${action.external_id}:${action.recorded_at}`,
                            user_id: cfg.user_id,
                            text: `Source item deleted: ${action.external_id}`,
                            at: action.recorded_at,
                            observed_at: action.recorded_at,
                            valid_from: action.recorded_at,
                            world_id: target.world.world_id,
                            facet_hint: 'reflective',
                            external: true,
                            source: { id: plan.connector_id, kind: 'api', reliability: 0.8 },
                            contract: { use_for_reasoning: false, use_for_personalization: false, expires_if_unconfirmed: true },
                            metadata: { source_deleted: true, external_id: action.external_id, reason: action.reason },
                        });
                        replacement = tombstone.node.id;
                        deletion_replacements.set(action.external_id, replacement);
                        edge_context.add_node(tombstone.node);
                        collect_ingest(tombstone);
                    }
                    if (!replacement) throw new Error(`connector supersession replacement not found for ${action.external_id}`);
                    explicit_edges.push(import_edge({
                        key: `action:${action.type}:${action.external_id}`,
                        from: replacement,
                        to: action.target_node_id,
                        type: 'supersedes',
                        confidence: 1,
                        weight: 1,
                        valid_from: action.recorded_at,
                        valid_to: null,
                        observed_at: action.recorded_at,
                        recorded_at: action.recorded_at,
                        metadata: { action: action.type, reason: action.reason },
                    }, node_ids, edge_context));
                }
                for (const node of edge_context.changed_node_list()) {
                    engine.graph.apply_node_version(node);
                    engine.index.add(node);
                    nodes_to_persist.set(node.id, node);
                }
                for (const edge of explicit_edges) {
                    engine.graph.add_edge(edge);
                    const from = engine.graph.get_node(edge.from);
                    if (from) {
                        engine.worlds.add_edge_to_world(from.world.world_id, edge.id);
                        touch_world_path(from.world.world_id);
                    }
                    if (!before_edges.has(edge.id)) {
                        edges_to_persist.set(edge.id, edge);
                        created_edge_ids.add(edge.id);
                    }
                }
                if (store) store.transaction(() => {
                    store.save_batch([...nodes_to_persist.values()], [...edges_to_persist.values()]);
                    for (const world_id of touched_world_ids) {
                        const world = engine.worlds.get_world(world_id);
                        if (world) store.save_world(world, false);
                    }
                    for (const node_id of created_node_ids) {
                        const node = engine.graph.get_node(node_id);
                        if (node) store.add_world_node_ref(node.world.world_id, node.id);
                    }
                    for (const edge_id of created_edge_ids) {
                        const edge = engine.graph.get_edge(edge_id);
                        const source = edge ? engine.graph.get_node(edge.from) : undefined;
                        if (source) store.add_world_edge_ref(source.world.world_id, edge_id);
                    }
                    for (const entity_id of touched_entity_ids) {
                        const entity = engine.resolver.get_entity(entity_id);
                        if (entity) store.save_entity(entity);
                    }
                    for (const ref of touched_fact_refs) {
                        const fact = engine.worlddb.get(ref);
                        if (fact) store.save_grounded_fact(fact);
                    }
                    store.save_sketch_state('global', engine.sketches, plan.recorded_at);
                });
                return {
                    plan_id: plan.sync_item_id,
                    node_ids: engine.graph.node_list().filter((node) => !before_nodes.has(node.id)).map((node) => node.id),
                    edge_ids: engine.graph.edge_list().filter((edge) => !before_edges.has(edge.id)).map((edge) => edge.id),
                    world_ids: engine.worlds.world_list().filter((world) => !before_worlds.has(world.id)).map((world) => world.id),
                    entity_ids: engine.resolver.entity_list().filter((entity) => !before_entities.has(entity.id)).map((entity) => entity.id),
                };
            });
        },
        async close() {
            if (closed) return;
            if (store && config.readonly !== true) store.save_sketch_state('global', engine.sketches);
            store?.close();
            closed = true;
        },
        status: () => ({ name: 'openmemory-hydrograph', phase: 'phase-19-public-api', ready: !closed, store: cfg.store }),
        invariants: () => hydrograph_invariants,
    };
    return api;
}

export { create_memory as createMemory };