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
 *  file  : tests/phase3_temporal.test.ts
 *  usage : verifies LongMemory phase3 temporal.test behavior
 */

import { describe, expect, it } from 'vitest';
import {
    after,
    before,
    contains,
    create_hydro_node,
    default_contract,
    default_node_state,
    during,
    empty_facets,
    equals,
    is_current,
    manual_provenance,
    overlaps,
    query_belief_as_of,
    query_bitemporal,
    query_current_truth,
    query_history,
    supersede_node,
    type HydroNodeInput,
    type Interval,
} from '../src/core/index.js';

const jan = Date.UTC(2026, 0, 1);
const feb = Date.UTC(2026, 1, 1);
const mar = Date.UTC(2026, 2, 1);
const apr = Date.UTC(2026, 3, 1);

function fact_input(raw: string, valid_from: number, recorded_at: number): HydroNodeInput {
    return {
        content: { raw, canonical: raw.toLowerCase(), summary: raw },
        facets: { ...empty_facets(), semantic: { value: raw, weight: 0.9 } },
        world: {
            world_id: 'world:root',
            parent_world_id: null,
            zone: 'endocortex',
            scope_path: ['root'],
        },
        temporal: {
            valid_from: valid_from,
            valid_to: null,
            observed_at: valid_from,
            recorded_at: recorded_at,
            superseded_at: null,
        },
        contract: default_contract(),
        grounding: { worlddb_ref: null, source_ids: [], grounding_score: 0 },
        state: default_node_state(),
        vectors: { semantic: null, type_vector: null, world_vector: null },
        provenance: manual_provenance('tester', recorded_at),
    };
}


const python_fact = create_hydro_node(fact_input('I use Python', jan, jan));

const ts_fact = create_hydro_node(fact_input('I use TypeScript', mar, mar));


const { superseded: python_closed, current: ts_current } = supersede_node(python_fact, ts_fact, mar);
const candidates = [python_closed, ts_current];

describe('phase 3 bitemporal MVCC', () => {
    it('1. old fact is current before supersession', () => {
        expect(is_current(python_fact, feb)).toBe(true);
    });

    it('2. old fact is not current after supersession', () => {
        expect(is_current(python_closed, apr)).toBe(false);
    });

    it('3. old fact remains visible in historical recall', () => {
        const history = query_history(candidates, feb);
        expect(history.map((n) => n.content.raw)).toContain('I use Python');
    });

    it('4. current truth returns only the latest active fact', () => {
        const current = query_current_truth(candidates, apr);
        expect(current).toHaveLength(1);
        expect(current[0].content.raw).toBe('I use TypeScript');
    });

    it('5. belief as-of a past recorded time differs from corrected truth', () => {
        const belief_before_correction = query_belief_as_of(candidates, feb);
        const current_truth = query_current_truth(candidates, apr);
        expect(belief_before_correction.map((n) => n.content.raw)).toEqual(['I use Python']);
        expect(current_truth.map((n) => n.content.raw)).toEqual(['I use TypeScript']);
        expect(belief_before_correction[0].content.raw).not.toBe(current_truth[0].content.raw);
    });

    it('6. strict recall candidates exclude superseded facts', () => {
        const strict = query_current_truth(candidates, apr);
        expect(strict.map((n) => n.id)).not.toContain(python_closed.id);
    });

    it('7. historical recall includes superseded facts valid at the requested time', () => {
        const history_before = query_history(candidates, feb);
        expect(history_before.map((n) => n.content.raw)).toEqual(['I use Python']);

        const history_after = query_history(candidates, apr);
        expect(history_after.map((n) => n.content.raw)).toEqual(['I use TypeScript']);
    });

    it('keeps identity stable across supersession (hash unchanged)', () => {
        expect(python_closed.id).toBe(python_fact.id);
        expect(python_closed.content_hash).toBe(python_fact.content_hash);
        expect(python_closed.temporal.valid_to).toBe(mar);
        expect(python_closed.temporal.superseded_at).toBe(mar);
    });

    it('supports full bitemporal queries', () => {
        
        
        const known_in_feb = query_bitemporal(candidates, feb, feb);
        expect(known_in_feb.map((n) => n.content.raw)).toEqual(['I use Python']);
    });
});

describe('phase 3 Allen interval relations', () => {
    const a: Interval = { start: 0, end: 10 };
    const b: Interval = { start: 10, end: 20 };
    const c: Interval = { start: 2, end: 6 };
    const open: Interval = { start: 0, end: null };

    it('before / after', () => {
        expect(before(a, b)).toBe(true);
        expect(after(b, a)).toBe(true);
        expect(before(b, a)).toBe(false);
    });

    it('overlaps', () => {
        expect(overlaps(a, c)).toBe(true);
        expect(overlaps(a, b)).toBe(false);
        expect(overlaps(open, b)).toBe(true);
    });

    it('during / contains', () => {
        expect(during(c, a)).toBe(true);
        expect(contains(a, c)).toBe(true);
        expect(during(a, c)).toBe(false);
    });

    it('equals', () => {
        expect(equals(a, { start: 0, end: 10 })).toBe(true);
        expect(equals(open, { start: 0, end: null })).toBe(true);
        expect(equals(a, b)).toBe(false);
    });
});
