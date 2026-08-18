import { describe, expect, it } from 'vitest';
import {
    create_exocortex_fact,
    create_hydro_node,
    default_contract,
    default_node_state,
    empty_facets,
    InMemoryRecallIndex,
    InMemoryWorldDB,
    manual_provenance,
    reconsolidate_memory,
    strict_recall,
    type Contract,
    type Contradiction,
    type Facets,
    type GroundingSource,
    type HydroEdge,
    type HydroNodeInput,
    type NodeState,
} from '../src/core/index.js';

const now = 1_700_000_000_000;
const day = 86_400_000;

function make_node(
    id: string,
    text: string,
    over: {
        contract?: Partial<Contract>;
        state?: Partial<NodeState>;
        temporal?: Partial<HydroNodeInput['temporal']>;
        grounding?: Partial<HydroNodeInput['grounding']>;
        facets?: Facets;
        vector?: number[] | null;
    } = {},
) {
    const input: HydroNodeInput = {
        id,
        content: { raw: text, canonical: text.toLowerCase(), summary: text },
        facets: over.facets ?? empty_facets(),
        world: { world_id: 'world:root', parent_world_id: null, zone: 'endocortex', scope_path: ['root'] },
        temporal: { valid_from: now, valid_to: null, observed_at: now, recorded_at: now, superseded_at: null, ...over.temporal },
        contract: { ...default_contract(), ...over.contract },
        grounding: { worlddb_ref: null, source_ids: [], grounding_score: 0, ...over.grounding },
        state: { ...default_node_state(), confidence: 0.9, ...over.state },
        vectors: { semantic: over.vector ?? null, type_vector: null, world_vector: null },
        provenance: manual_provenance('tester', now),
    };
    return create_hydro_node(input);
}

function supersedes(new_id: string, old_id: string): HydroEdge {
    return {
        id: `edge:${new_id}->${old_id}`,
        from: new_id,
        to: old_id,
        type: 'supersedes',
        confidence: 1,
        weight: 1,
        temporal: { valid_from: now, valid_to: null, observed_at: now, recorded_at: now },
        handler: { handler: 'supersedes', params: {} },
        provenance: manual_provenance('tester', now),
    };
}

const source: GroundingSource = { id: 'sensor', kind: 'sensor', reliability: 0.95 };

describe('phase 14 reconsolidation engine', () => {
    it('1. old wrong belief reconsolidates into a historical memory', () => {
        const old = make_node('flat', 'the earth is flat', {
            temporal: { superseded_at: now - 10 * day },
            state: { status: 'superseded' },
        });
        const current = make_node('round', 'the earth is round', { temporal: { observed_at: now - 5 * day, valid_from: now - 5 * day } });
        const edges = [supersedes('round', 'flat')];

        const view = reconsolidate_memory(old, { now: now, nodes: [old, current], edges });

        expect(view.is_superseded).toBe(true);
        expect(view.recommended_mode).toBe('historical');
        expect(view.current_truth?.id).toBe('round');
        expect(view.warnings.some((w) => w.includes('superseded'))).toBe(true);
    });

    it('2. current strict recall uses the superseding memory', () => {
        const old = make_node('tea', 'I prefer tea', {
            temporal: { superseded_at: now - day },
            state: { status: 'superseded' },
        });
        const current = make_node('coffee', 'I prefer coffee');
        const index = new InMemoryRecallIndex([old, current]);

        const strict = strict_recall({ text: 'what do I prefer', now: now }, { index });
        const ids = strict.items.map((i) => i.node.id);
        expect(ids).toContain('coffee');
        expect(ids).not.toContain('tea');

        // The superseding memory reconsolidates as current, strict-usable truth.
        const view = reconsolidate_memory(current, { now: now, nodes: [old, current], edges: [supersedes('coffee', 'tea')] });
        expect(view.is_superseded).toBe(false);
        expect(view.recommended_mode).toBe('strict');
    });

    it('3. the original immutable node is unchanged', () => {
        const old = make_node('flat', 'the earth is flat', { state: { status: 'superseded' } });
        const snapshot = JSON.stringify(old);

        reconsolidate_memory(old, { now: now, nodes: [old], edges: [] });

        expect(JSON.stringify(old)).toBe(snapshot);
        expect(Object.isFrozen(old)).toBe(true);
    });

    it('4. reconsolidation preserves the provenance trace', () => {
        const node = make_node('n', 'I visited Rome in spring');
        const view = reconsolidate_memory(node, { now: now, nodes: [node], edges: [] });

        expect(view.provenance.source_trace.length).toBeGreaterThan(0);
        expect(view.historical_residue.provenance.source_trace.length).toBeGreaterThan(0);
        expect(view.historical_residue.memory_id).toBe('n');
    });

    it('5. a world update changes the reconsolidated view', () => {
        const worlddb = new InMemoryWorldDB(() => now);
        const fact = create_exocortex_fact({ statement: 'a tiger is in the room', source, vector: [1, 0, 0], observed_at: now, observation_count: 4 });
        worlddb.upsert(fact);

        // A fear memory grounded to the tiger fact.
        const fear = make_node('fear', 'a tiger is in the room and I am afraid', {
            grounding: { worlddb_ref: fact.ref, source_ids: ['sensor'], grounding_score: 0.8 },
            facets: { ...empty_facets(), emotional: { value: 'fear', weight: 0.9 } },
            vector: [1, 0, 0],
        });
        const ctx = { now: now, nodes: [fear], edges: [] as HydroEdge[], worlddb };

        const before = reconsolidate_memory(fear, ctx);
        expect(before.grounding.still_valid).toBe(true);
        expect(before.recommended_mode).toBe('world_grounded');

        // The tiger leaves — the external world no longer asserts the fact.
        worlddb.expire(fact.ref, now);
        const after = reconsolidate_memory(fear, ctx);

        expect(after.grounding.still_valid).toBe(false);
        expect(after.recommended_mode).not.toBe('world_grounded');
        expect(after.recommended_mode).toBe('associative');
        expect(after.warnings.some((w) => w.includes('grounding no longer valid'))).toBe(true);
        // The fear residue is preserved historically.
        expect(after.historical_residue.emotional_residue?.value).toBe('fear');
    });

    it('6. a contradicted memory returns a warning and status', () => {
        const node = make_node('c', 'the meeting is on Friday', { state: { status: 'contradicted' } });
        const contradiction: Contradiction = {
            id: 'contra:1',
            node_a: 'c',
            node_b: 'other',
            severity: 0.8,
            created_at: now - day,
            resolved: false,
            pressure: 0.7,
        };

        const view = reconsolidate_memory(node, { now: now, nodes: [node], edges: [], contradictions: [contradiction] });

        expect(view.contradiction.contradicted).toBe(true);
        expect(view.contradiction.unresolved).toBe(true);
        expect(view.contradiction.warning).toContain('unresolved');
        expect(view.recommended_mode).toBe('associative');
        expect(view.warnings.length).toBeGreaterThan(0);
    });
});
