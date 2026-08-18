import { describe, expect, it } from 'vitest';
import {
    can_use_in_associative_recall,
    create_exocortex_fact,
    create_hydro_node,
    default_contract,
    default_node_state,
    empty_facets,
    grounded_recall,
    InMemoryRecallIndex,
    InMemoryWorldDB,
    manual_provenance,
    type GroundedDeps,
    type GroundingSource,
    type HydroNodeInput,
} from '../src/core/index.js';

const now = 1_700_000_000_000;
const day = 86_400_000;

const source: GroundingSource = { id: 'worlddb', kind: 'worlddb', reliability: 0.95 };

function endo_node(id: string, text: string, fact_ref: string | null, vector: number[]) {
    const input: HydroNodeInput = {
        id,
        content: { raw: text, canonical: text.toLowerCase(), summary: text },
        facets: { ...empty_facets(), emotional: { value: text, weight: 0.6 } },
        world: { world_id: 'world:root', parent_world_id: null, zone: 'endocortex', scope_path: ['root'] },
        temporal: { valid_from: now, valid_to: null, observed_at: now, recorded_at: now, superseded_at: null },
        contract: default_contract(),
        grounding: { worlddb_ref: fact_ref, source_ids: fact_ref ? ['worlddb'] : [], grounding_score: 0 },
        state: { ...default_node_state(), confidence: 0.9 },
        vectors: { semantic: vector, type_vector: null, world_vector: null },
        provenance: manual_provenance('tester', now),
    };
    return create_hydro_node(input);
}

describe('phase 12 world-grounded recall', () => {
    it('1. external world update changes recall output', () => {
        const worlddb = new InMemoryWorldDB(() => now);
        const fact = create_exocortex_fact({ statement: 'server located in Finland', source, vector: [1, 0, 0, 0], observed_at: now, observation_count: 5 });
        worlddb.upsert(fact);
        const node = endo_node('m', 'the server is in Finland', fact.ref, [1, 0, 0, 0]);
        const deps: GroundedDeps = { index: new InMemoryRecallIndex([node]), worlddb };

        const before = grounded_recall({ text: 'where is the server', now: now }, deps);
        expect(before.items.map((i) => i.node.id)).toContain('m');

        
        worlddb.expire(fact.ref, now);
        const after = grounded_recall({ text: 'where is the server', now: now }, deps);
        expect(after.items.map((i) => i.node.id)).not.toContain('m');
    });

    it('2. stale external fact is downranked', () => {
        const worlddb = new InMemoryWorldDB(() => now);
        const fresh_fact = create_exocortex_fact({ statement: 'fresh project fact', source, vector: [1, 0], observed_at: now, observation_count: 5 });
        const stale_fact = create_exocortex_fact({ statement: 'stale project fact', source, vector: [1, 0], observed_at: now - 20 * day, observation_count: 5 });
        worlddb.upsert(fresh_fact);
        worlddb.upsert(stale_fact);

        const fresh = endo_node('fresh', 'fresh project fact', fresh_fact.ref, [1, 0]);
        const stale = endo_node('stale', 'stale project fact', stale_fact.ref, [1, 0]);
        const deps: GroundedDeps = { index: new InMemoryRecallIndex([stale, fresh]), worlddb };

        const res = grounded_recall({ text: 'project fact', now: now }, deps);
        expect(res.items[0].node.id).toBe('fresh');
        const fresh_score = res.items.find((i) => i.node.id === 'fresh')!.grounding_score;
        const stale_score = res.items.find((i) => i.node.id === 'stale')!.grounding_score;
        expect(stale_score).toBeLessThan(fresh_score);
    });

    it('3. ungrounded factual claim is rejected', () => {
        const worlddb = new InMemoryWorldDB(() => now);
        const node = endo_node('u', 'the capital is definitely X', null, [1, 0, 0, 0]);
        const deps: GroundedDeps = { index: new InMemoryRecallIndex([node]), worlddb };

        const res = grounded_recall({ text: 'what is the capital', now: now }, deps);
        expect(res.items.length).toBe(0);
        expect(res.trace.candidates.find((c) => c.memory_id === 'u')?.grounded).toBe(false);
    });

    it('4. subjective memory: not in grounded recall, still in associative recall', () => {
        const worlddb = new InMemoryWorldDB(() => now);
        const node = endo_node('s', 'I felt scared the tiger was here', null, [1, 0, 0, 0]);
        const deps: GroundedDeps = { index: new InMemoryRecallIndex([node]), worlddb };

        const grounded = grounded_recall({ text: 'was the tiger here', now: now }, deps);
        expect(grounded.items.map((i) => i.node.id)).not.toContain('s');

        
        const assoc = can_use_in_associative_recall(node, { now: now });
        expect(assoc.allowed).toBe(true);
        expect(assoc.label).toBe('emotional_residue');
    });

    it('5. grounding trace includes source and freshness', () => {
        const worlddb = new InMemoryWorldDB(() => now);
        const fact = create_exocortex_fact({ statement: 'grounded fact', source, vector: [1, 0], observed_at: now, observation_count: 5 });
        worlddb.upsert(fact);
        const node = endo_node('g', 'grounded fact', fact.ref, [1, 0]);
        const deps: GroundedDeps = { index: new InMemoryRecallIndex([node]), worlddb };

        const res = grounded_recall({ text: 'grounded fact', now: now }, deps);
        const trace = res.trace.candidates.find((c) => c.memory_id === 'g')!;
        expect(trace.source_id).toBe('worlddb');
        expect(trace.source_kind).toBe('worlddb');
        expect(trace.freshness).toBeGreaterThan(0);
        expect(trace.grounding_score).toBeGreaterThan(0);
        expect(trace.reconciliation).toBe('confirmed');
    });

    it('follows grounds edges to resolve the exocortex fact', () => {
        const worlddb = new InMemoryWorldDB(() => now);
        const fact = create_exocortex_fact({ statement: 'edge grounded fact', source, vector: [1, 0], observed_at: now, observation_count: 5 });
        worlddb.upsert(fact);
        
        const node = endo_node('e', 'edge grounded fact', null, [1, 0]);
        const grounds_edge = {
            id: 'edge:e',
            from: 'e',
            to: fact.ref,
            type: 'grounds',
            confidence: 0.9,
            weight: 1,
            temporal: { valid_from: now, valid_to: null, observed_at: now, recorded_at: now },
            handler: { handler: 'grounds', params: {} },
            provenance: manual_provenance('tester', now),
        };
        
        const deps: GroundedDeps = { index: new InMemoryRecallIndex([node]), worlddb, grounds_edges: [grounds_edge] };

        const res = grounded_recall({ text: 'edge grounded fact', now: now }, deps);
        expect(res.trace.candidates.find((c) => c.memory_id === 'e')?.grounded).toBe(true);
    });
});
