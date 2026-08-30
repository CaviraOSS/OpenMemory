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
 *  file  : tests/phase15_consolidation.test.ts
 *  usage : verifies LongMemory phase15 consolidation.test behavior
 */

import { describe, expect, it } from 'vitest';
import { quality_report } from '../benchmarks/src/metrics.js';
import {
    consolidate_memories,
    create_exocortex_fact,
    create_hydro_node,
    default_contract,
    default_node_state,
    empty_facets,
    InMemoryRecallIndex,
    InMemoryWorldDB,
    manual_provenance,
    strict_recall,
    type Contract,
    type Contradiction,
    type GroundingSource,
    type HydroNodeInput,
    type NodeState,
} from '../src/core/index.js';

const now = 1_700_000_000_000;
const day = 86_400_000;

function episode(
    id: string,
    text: string,
    over: {
        contract?: Partial<Contract>;
        state?: Partial<NodeState>;
        temporal?: Partial<HydroNodeInput['temporal']>;
        grounding?: Partial<HydroNodeInput['grounding']>;
        vector?: number[] | null;
    } = {},
) {
    return create_hydro_node({
        id,
        content: { raw: text, canonical: text.toLowerCase(), summary: text },
        facets: { ...empty_facets(), episodic: { value: text, weight: 1 } },
        world: { world_id: 'world:root', parent_world_id: null, zone: 'endocortex', scope_path: ['root'] },
        temporal: {
            valid_from: now,
            valid_to: null,
            observed_at: now,
            recorded_at: now,
            superseded_at: null,
            ...over.temporal,
        },
        contract: { ...default_contract(), ...over.contract },
        grounding: { worlddb_ref: null, source_ids: [], grounding_score: 0, ...over.grounding },
        state: { ...default_node_state(), confidence: 0.9, salience: 0.7, ...over.state },
        vectors: { semantic: over.vector ?? null, type_vector: null, world_vector: null },
        provenance: manual_provenance('tester', now),
    });
}

describe('phase 15 consolidation engine', () => {
    it('1. repeated preference becomes stable semantic memory', () => {
        const sources = [
            episode('pref:1', 'I prefer Vim as my editor'),
            episode('pref:2', 'I prefer Vim as my editor', { temporal: { observed_at: now + day } }),
            episode('pref:3', 'I prefer Vim as my editor', { temporal: { observed_at: now + 2 * day } }),
        ];

        const out = consolidate_memories(sources, { now: now + 3 * day });
        const semantic = out.memories.find((node) => node.facets.semantic !== null);

        expect(semantic).toBeDefined();
        expect(semantic!.facets.semantic?.value).toContain('prefer Vim');
        expect(semantic!.contract).toBeDefined();
        expect(semantic!.state.confidence).toBeGreaterThanOrEqual(0.9);
        expect(out.source_count).toBe(3);
        expect(sources.every((node) => Object.isFrozen(node))).toBe(true);
    });

    it('2. repeated failure becomes procedural lesson', () => {
        const sources = [
            episode('fail:1', 'deployment failed because the config file was missing'),
            episode('fail:2', 'deployment failed because the config file was missing'),
        ];

        const out = consolidate_memories(sources, { now: now + day });
        const procedure = out.memories.find((node) => node.facets.procedural !== null);

        expect(procedure).toBeDefined();
        expect(procedure!.facets.procedural?.value).toContain('repeated outcomes');
        expect(procedure!.content.summary).toContain('config file was missing');
    });

    it('3. contradiction cluster becomes reflection', () => {
        const finland = episode('place:fi', 'the production server is in Finland');
        const sweden = episode('place:se', 'the production server is in Sweden', {
            state: { status: 'contradicted' },
        });
        const contradiction: Contradiction = {
            id: 'contra:place',
            node_a: finland.id,
            node_b: sweden.id,
            severity: 0.8,
            created_at: now,
            resolved: false,
            pressure: 0.8,
        };

        const out = consolidate_memories([finland, sweden], {
            now: now + day,
            contradictions: [contradiction],
        });
        const reflection = out.memories.find((node) => node.facets.reflective !== null);

        expect(reflection).toBeDefined();
        expect(reflection!.content.summary).toContain('Finland');
        expect(reflection!.content.summary).toContain('Sweden');
        expect(reflection!.contract.use_for_reasoning).toBe(false);
    });

    it('4. every consolidated memory links to all source memories', () => {
        const sources = [
            episode('link:1', 'I prefer tea after lunch'),
            episode('link:2', 'I prefer tea after lunch'),
            episode('link:3', 'I prefer tea after lunch'),
        ];
        const out = consolidate_memories(sources, { now: now + day });
        const memory = out.memories[0];
        const links = out.edges.filter((edge) => edge.from === memory.id && edge.type === 'derived_from');

        expect(new Set(links.map((edge) => edge.to))).toEqual(new Set(sources.map((node) => node.id)));
        expect(links).toHaveLength(sources.length);
        expect(memory.provenance.source_trace.map((item) => item.source_id)).toEqual(
            expect.arrayContaining(sources.map((node) => node.id)),
        );
    });

    it('5. consolidation improves the recall quality benchmark', () => {
        const sources = [
            episode('editor:1', 'I prefer Vim as my editor'),
            episode('editor:2', 'I prefer Vim as my editor'),
            episode('noise:1', 'I saw a film last weekend'),
        ];
        const query = { text: 'stable semantic editor preference', now: now + day, k: 1 };
        const out = consolidate_memories(sources, { now: now + day });
        const semantic = out.memories.find((node) => node.facets.semantic !== null)!;
        const relevant = new Set([semantic.id]);

        const before_ids = strict_recall(query, { index: new InMemoryRecallIndex(sources) }).items.map((item) => item.node.id);
        const after_ids = strict_recall(query, { index: new InMemoryRecallIndex([...sources, ...out.memories]) }).items.map((item) => item.node.id);
        const before = quality_report([{ retrieved: before_ids, relevant }], 1);
        const after = quality_report([{ retrieved: after_ids, relevant }], 1);

        expect(after.mrr).toBeGreaterThan(before.mrr);
        expect(after.recall_at_k).toBeGreaterThanOrEqual(before.recall_at_k);
    });

    it('6. consolidation does not leak stale facts into strict recall', () => {
        const worlddb = new InMemoryWorldDB(() => now);
        const fact = create_exocortex_fact({
            ref: 'fact:badge',
            statement: 'the access badge is valid',
            source: { id: 'worlddb', kind: 'worlddb', reliability: 0.95 },
            observed_at: now - 60 * day,
            valid_to: now - day,
        });
        worlddb.upsert(fact);
        const stale = [
            episode('badge:1', 'the access badge is valid', {
                contract: { requires_grounding: true },
                grounding: { worlddb_ref: fact.ref, source_ids: ['worlddb'], grounding_score: 0.9 },
                temporal: { valid_to: now - day, superseded_at: now - day },
                state: { status: 'superseded' },
            }),
            episode('badge:2', 'the access badge is valid', {
                contract: { requires_grounding: true },
                grounding: { worlddb_ref: fact.ref, source_ids: ['worlddb'], grounding_score: 0.9 },
                temporal: { valid_to: now - day, superseded_at: now - day },
                state: { status: 'superseded' },
            }),
        ];

        const out = consolidate_memories(stale, { now, worlddb });
        const strict = strict_recall(
            { text: 'is the access badge valid', now },
            { index: new InMemoryRecallIndex([...stale, ...out.memories]) },
        );

        expect(out.memories.every((node) => node.state.status === 'superseded')).toBe(true);
        expect(strict.items).toHaveLength(0);
    });

    it('creates a current grounded belief from a world correction', () => {
        const old = episode('server:old', 'the server is in Finland', {
            state: { status: 'superseded' },
            temporal: { superseded_at: now },
        });
        const source: GroundingSource = { id: 'worlddb', kind: 'worlddb', reliability: 0.98 };
        const fact = create_exocortex_fact({
            ref: 'fact:server:sweden',
            statement: 'the server is in Sweden',
            source,
            observed_at: now,
            vector: [0, 1],
        });

        const out = consolidate_memories([old], {
            now,
            world_corrections: [{ fact, source_memory_ids: [old.id] }],
        });
        const corrected = out.memories.find((node) => node.grounding.worlddb_ref === fact.ref);

        expect(corrected?.facets.semantic?.value).toBe(fact.statement);
        expect(corrected?.contract.requires_grounding).toBe(true);
        expect(corrected?.temporal.valid_from).toBe(fact.valid_from);
        expect(out.edges.some((edge) => edge.from === corrected?.id && edge.to === old.id)).toBe(true);
    });
});