import { describe, expect, it } from 'vitest';
import {
    apply_contract_gate,
    can_use_in_associative_recall,
    can_use_in_historical_recall,
    can_use_in_strict_recall,
    can_use_in_world_grounded_recall,
    create_hydro_node,
    default_contract,
    default_node_state,
    empty_facets,
    type Contract,
    type HydroNodeInput,
    type NodeState,
} from '../src/core/index.js';

const now = 1_700_000_000_000;
const day = 86_400_000;

function node(over: {
    contract?: Partial<Contract>;
    state?: Partial<NodeState>;
    temporal?: Partial<HydroNodeInput['temporal']>;
    grounding?: Partial<HydroNodeInput['grounding']>;
    facets?: HydroNodeInput['facets'];
    with_source?: boolean;
} = {}) {
    const input: HydroNodeInput = {
        content: { raw: 'a fact', canonical: 'a fact', summary: 'a fact' },
        facets: over.facets ?? empty_facets(),
        world: { world_id: 'world:x', parent_world_id: null, zone: 'endocortex', scope_path: ['x'] },
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
        state: { ...default_node_state(), ...over.state },
        vectors: { semantic: null, type_vector: null, world_vector: null },
        provenance: {
            created_by: 'tester',
            extraction_method: 'manual',
            source_trace: over.with_source === false ? [] : [{ source_id: 's1', ref: null, at: now }],
        },
    };
    return create_hydro_node(input);
}

describe('phase 8 recall mode gates', () => {
    it('1. strict recall rejects superseded memory', () => {
        const n = node({ temporal: { superseded_at: now + day }, state: { status: 'superseded' } });
        const r = can_use_in_strict_recall(n, { now: now + 2 * day });
        expect(r.allowed).toBe(false);
        expect(r.reasons).toContain('superseded');
    });

    it('2. historical recall includes superseded memory when time-valid', () => {
        
        const n = node({ temporal: { valid_from: now, valid_to: now + 60 * day, superseded_at: now + 60 * day }, state: { status: 'superseded' } });
        const r = can_use_in_historical_recall(n, { now: now + 90 * day, at: now + 30 * day });
        expect(r.allowed).toBe(true);
        expect(r.label).toBe('superseded');
    });

    it('3. associative recall includes emotional old memory but labels it', () => {
        const facets = { ...empty_facets(), emotional: { value: 'felt scared', weight: 0.8 } };
        const n = node({ facets, temporal: { superseded_at: now + day }, state: { status: 'superseded' } });
        const r = can_use_in_associative_recall(n, { now: now + 2 * day });
        expect(r.allowed).toBe(true);
        expect(r.label).toBe('emotional_residue');
    });

    it('4. world-grounded recall rejects an ungrounded fact', () => {
        const n = node({ grounding: { worlddb_ref: null, grounding_score: 0 } });
        const r = can_use_in_world_grounded_recall(n, { now: now, freshness: 0.9, source_reliability: 0.9 });
        expect(r.allowed).toBe(false);
        expect(r.reasons.some((x) => x.includes('not grounded'))).toBe(true);
    });

    it('5. personalization-only memory is not used for factual reasoning', () => {
        const n = node({ contract: { use_for_reasoning: false, use_for_personalization: true } });
        const r = can_use_in_strict_recall(n, { now: now });
        expect(r.allowed).toBe(false);
        expect(r.reasons).toContain('contract forbids reasoning');
    });

    it('6. expired unconfirmed memory is blocked', () => {
        const n = node({
            contract: { expires_if_unconfirmed: true, max_valid_duration: 10 * day },
            grounding: { grounding_score: 0 },
        });
        const r = can_use_in_strict_recall(n, { now: now + 20 * day });
        expect(r.allowed).toBe(false);
        expect(r.reasons.some((x) => x.includes('expired'))).toBe(true);
    });

    it('strict recall admits a clean, current, confident memory', () => {
        const n = node({ state: { status: 'active', confidence: 0.9 } });
        const r = apply_contract_gate(n, 'strict', { now: now });
        expect(r.allowed).toBe(true);
        expect(r.label).toBe('active');
    });

    it('world-grounded recall admits a fresh, grounded, sourced fact', () => {
        const n = node({
            grounding: { worlddb_ref: 'fact:1', grounding_score: 0.8, source_ids: ['s1'] },
        });
        const r = apply_contract_gate(n, 'world_grounded', { now: now, freshness: 0.9, source_reliability: 0.9 });
        expect(r.allowed).toBe(true);
        expect(r.label).toBe('grounded');
    });

    it('strict recall rejects low confidence and unresolved contradiction', () => {
        const low_conf = node({ state: { confidence: 0.2 } });
        expect(can_use_in_strict_recall(low_conf, { now: now }).allowed).toBe(false);

        const clean = node({ state: { confidence: 0.9 } });
        expect(can_use_in_strict_recall(clean, { now: now, unresolved_contradiction: true }).allowed).toBe(false);
    });
});
