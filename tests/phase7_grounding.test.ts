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
 *  file  : tests/phase7_grounding.test.ts
 *  usage : verifies LongMemory phase7 grounding.test behavior
 */

import { describe, expect, it } from 'vitest';
import {
    compute_resonance,
    create_exocortex_fact,
    GroundingLayer,
    type GroundingSource,
} from '../src/core/index.js';

const now = 1_700_000_000_000;
const day = 86_400_000;

const reliable_source: GroundingSource = { id: 'worlddb', kind: 'worlddb', reliability: 0.95 };

function layer(): GroundingLayer {
    return new GroundingLayer({ now: now });
}

describe('phase 7 grounding layer', () => {
    it('1. subjective memory exists without grounding', () => {
        const g = layer();
        g.add_memory({ id: 'm1', zone: 'endocortex', statement: 'I prefer tea', requires_grounding: false });
        expect(g.validate_grounding_requirement('m1')).toBe(true);
        expect(g.grounding_trace_for('m1')).toBeUndefined();
    });

    it('2. factual memory requiring grounding is rejected if ungrounded', () => {
        const g = layer();
        g.add_memory({ id: 'm1', zone: 'endocortex', statement: 'the server is in Finland', requires_grounding: true });
        expect(g.validate_grounding_requirement('m1')).toBe(false);
    });

    it('3. grounded fact improves strict recall eligibility', () => {
        const g = layer();
        g.add_memory({
            id: 'm1',
            zone: 'endocortex',
            statement: 'the server is in Finland',
            vector: [1, 0, 0, 0],
            requires_grounding: true,
        });
        expect(g.validate_grounding_requirement('m1')).toBe(false);

        const fact = g.create_exocortex_fact({
            statement: 'server located in Finland',
            source: reliable_source,
            vector: [1, 0, 0, 0],
            observed_at: now,
            observation_count: 5,
        });
        const trace = g.ground_memory_to_fact('m1', fact.ref);

        expect(trace.grounding_score).toBeGreaterThanOrEqual(0.6);
        expect(g.validate_grounding_requirement('m1')).toBe(true);
        expect(g.find_grounded_memories().map((m) => m.id)).toContain('m1');
    });

    it('4. stale external fact reduces grounding score', () => {
        const g = layer();
        const memory = g.add_memory({ id: 'm1', zone: 'endocortex', statement: 'fact', vector: [1, 0], requires_grounding: true });

        const fresh = create_exocortex_fact({ statement: 'x', source: reliable_source, vector: [1, 0], observed_at: now, observation_count: 5 });
        const stale = create_exocortex_fact({
            statement: 'x',
            source: reliable_source,
            vector: [1, 0],
            observed_at: now - 300 * day,
            valid_to: now - 200 * day,
            observation_count: 5,
        });

        const fresh_trace = g.compute_grounding_score(memory, fresh);
        const stale_trace = g.compute_grounding_score(memory, stale);
        expect(stale_trace.grounding_score).toBeLessThan(fresh_trace.grounding_score);
        expect(stale_trace.signals.freshness).toBeLessThan(fresh_trace.signals.freshness);
    });

    it('5. world update changes related memory state', () => {
        const g = layer();
        g.add_memory({ id: 'm1', zone: 'endocortex', statement: 'server in Finland', vector: [1, 0], requires_grounding: true });
        const fact = g.create_exocortex_fact({ statement: 'server in Finland', source: reliable_source, vector: [1, 0], observed_at: now, observation_count: 5 });
        g.ground_memory_to_fact('m1', fact.ref);

        const before = g.get_memory('m1')!.grounding_score;
        
        g.worlddb.expire(fact.ref, now + day);
        const after = g.get_memory('m1')!.grounding_score;

        expect(after).toBeLessThan(before);
    });

    it('6. grounding trace is explainable', () => {
        const g = layer();
        g.add_memory({ id: 'm1', zone: 'endocortex', statement: 'fact', vector: [1, 0], requires_grounding: true });
        const fact = g.create_exocortex_fact({ statement: 'fact', source: reliable_source, vector: [1, 0], observed_at: now, observation_count: 4 });
        const trace = g.ground_memory_to_fact('m1', fact.ref);

        expect(trace.explanation.length).toBeGreaterThan(0);
        expect(trace.explanation.some((line) => line.includes('grounding_score'))).toBe(true);
        expect(trace.signals.source_reliability).toBe(0.95);
        expect(trace.fact_ref).toBe(fact.ref);
    });

    it('removed fact makes a required memory ineligible again', () => {
        const g = layer();
        g.add_memory({ id: 'm1', zone: 'endocortex', statement: 'fact', vector: [1, 0], requires_grounding: true });
        const fact = g.create_exocortex_fact({ statement: 'fact', source: reliable_source, vector: [1, 0], observed_at: now, observation_count: 5 });
        g.ground_memory_to_fact('m1', fact.ref);
        expect(g.validate_grounding_requirement('m1')).toBe(true);

        g.worlddb.remove(fact.ref, now + day);
        expect(g.validate_grounding_requirement('m1')).toBe(false);
        expect(g.find_grounded_memories().map((m) => m.id)).not.toContain('m1');
    });

    it('resonance collapses to zero without grounding or temporal overlap', () => {
        expect(compute_resonance({ semantic_similarity: 0.9, grounding_score: 0, temporal_overlap: 1, relation_weight: 1 })).toBe(0);
        expect(compute_resonance({ semantic_similarity: 0.9, grounding_score: 0.8, temporal_overlap: 0, relation_weight: 1 })).toBe(0);
        expect(compute_resonance({ semantic_similarity: 0.9, grounding_score: 0.8, temporal_overlap: 1, relation_weight: 1 })).toBeCloseTo(0.72, 5);
    });
});
