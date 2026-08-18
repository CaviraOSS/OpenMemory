import { describe, expect, it } from 'vitest';
import {
    create_hydro_edge,
    create_hydro_node,
    default_contract,
    default_node_state,
    empty_facets,
    historical_recall,
    InMemoryRecallIndex,
    manual_provenance,
    type HistoricalDeps,
    type HydroNodeInput,
} from '../src/core/index.js';

const jan = Date.UTC(2026, 0, 1);
const feb = Date.UTC(2026, 1, 1);
const mar = Date.UTC(2026, 2, 1);
const apr = Date.UTC(2026, 3, 1);

function pref_node(id: string, text: string, over: Partial<HydroNodeInput['temporal']>, superseded = false) {
    const input: HydroNodeInput = {
        id,
        content: { raw: text, canonical: text.toLowerCase(), summary: text },
        facets: empty_facets(),
        world: { world_id: 'world:root', parent_world_id: null, zone: 'endocortex', scope_path: ['root'] },
        temporal: { valid_from: jan, valid_to: null, observed_at: jan, recorded_at: jan, superseded_at: null, ...over },
        contract: default_contract(),
        grounding: { worlddb_ref: null, source_ids: [], grounding_score: 0 },
        state: { ...default_node_state(), status: superseded ? 'superseded' : 'active' },
        vectors: { semantic: null, type_vector: null, world_vector: null },
        provenance: manual_provenance('tester', jan),
    };
    return create_hydro_node(input);
}

function setup() {
    const tea = pref_node('tea', 'I prefer tea', { valid_from: jan, valid_to: mar, observed_at: jan, recorded_at: jan, superseded_at: mar }, true);
    const coffee = pref_node('coffee', 'I prefer coffee', { valid_from: mar, valid_to: null, observed_at: mar, recorded_at: mar, superseded_at: null });
    const edge = create_hydro_edge({
        from: coffee.id,
        to: tea.id,
        type: 'supersedes',
        confidence: 0.9,
        weight: 1,
        temporal: { valid_from: mar, valid_to: null, observed_at: mar, recorded_at: mar },
        handler: { handler: 'supersedes', params: {} },
        provenance: manual_provenance('tester', mar),
    });
    const index = new InMemoryRecallIndex([tea, coffee]);
    const deps: HistoricalDeps = { index, supersedes_edges: [edge] };
    return { tea, coffee, edge, index, deps };
}

describe('phase 11 historical recall', () => {
    it('1. old preference appears for past valid time', () => {
        const { deps } = setup();
        const res = historical_recall({ text: 'what do I prefer', now: apr, valid_time: feb }, deps);
        expect(res.timeline.world_truth_at_time.map((n) => n.id)).toContain('tea');
        expect(res.timeline.world_truth_at_time.map((n) => n.id)).not.toContain('coffee');
    });

    it('2. old preference does not appear as current truth', () => {
        const { deps } = setup();
        const res = historical_recall({ text: 'what do I prefer', now: apr, valid_time: feb }, deps);
        const current = res.timeline.current_truth.map((n) => n.id);
        expect(current).toContain('coffee');
        expect(current).not.toContain('tea');
    });

    it('3. agent belief before correction differs from current corrected truth', () => {
        const { deps } = setup();
        const res = historical_recall({ text: 'what do I prefer', now: apr, recorded_time: feb }, deps);
        const belief = res.timeline.agent_belief_at_time.map((n) => n.id);
        const current = res.timeline.current_truth.map((n) => n.id);
        expect(belief).toEqual(['tea']);
        expect(current).toEqual(['coffee']);
        expect(belief).not.toEqual(current);
    });

    it('4. supersession chain is explainable', () => {
        const { deps } = setup();
        const res = historical_recall({ text: 'what do I prefer', now: apr }, deps);
        expect(res.timeline.chains).toHaveLength(1);
        expect(res.timeline.chains[0].ordered).toEqual(['tea', 'coffee']);
    });

    it('5. historical recall includes recorded_at and valid_from/valid_to', () => {
        const { deps } = setup();
        const res = historical_recall({ text: 'what do I prefer', now: apr, valid_time: feb }, deps);
        const tea_entry = res.timeline.entries.find((e) => e.id === 'tea')!;
        expect(tea_entry.valid_from).toBe(jan);
        expect(tea_entry.valid_to).toBe(mar);
        expect(tea_entry.recorded_at).toBe(jan);
        expect(tea_entry.superseded_at).toBe(mar);
    });

    it('6. historical recall does not mutate memory', () => {
        const { tea, coffee, deps } = setup();
        const tea_snapshot = JSON.stringify(tea);
        const coffee_snapshot = JSON.stringify(coffee);

        historical_recall({ text: 'what do I prefer', now: apr, valid_time: feb, recorded_time: feb }, deps);

        expect(JSON.stringify(tea)).toBe(tea_snapshot);
        expect(JSON.stringify(coffee)).toBe(coffee_snapshot);
        expect(Object.isFrozen(tea)).toBe(true);
    });

    it('trace distinguishes the three temporal views', () => {
        const { deps } = setup();
        const res = historical_recall({ text: 'what do I prefer', now: apr, valid_time: feb, recorded_time: feb }, deps);
        expect(res.trace.world_truth_count).toBe(1);
        expect(res.trace.agent_belief_count).toBe(1);
        expect(res.trace.current_truth_count).toBe(1);
        expect(res.trace.retrieved).toBe(2);
    });
});
