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
 *  file  : tests/phase9_math.test.ts
 *  usage : verifies LongMemory phase9 math.test behavior
 */

import { describe, expect, it } from 'vitest';
import {
    activation,
    apply_contradiction_pressure,
    base_activation,
    blocks_strict_recall,
    compute_activation,
    contradiction_pressure,
    decay_rate,
    fuse_support,
    has_unresolved_contradiction,
    logit,
    memory_weight,
    retention,
    sigmoid,
    update_confidence_with_evidence,
    type Contradiction,
} from '../src/core/index.js';

describe('phase 9 memory math', () => {
    it('basic functions round-trip', () => {
        expect(sigmoid(0)).toBeCloseTo(0.5, 6);
        expect(sigmoid(logit(0.73))).toBeCloseTo(0.73, 6);
    });

    it('1. supporting evidence increases confidence (and stays below 1)', () => {
        const prior = 0.5;
        const after = fuse_support(prior, [
            { source_reliability: 0.9, likelihood_ratio: 4 },
            { source_reliability: 0.8, likelihood_ratio: 3 },
        ]);
        expect(after).toBeGreaterThan(prior);
        expect(after).toBeLessThan(1);
    });

    it('2. contradiction reduces confidence', () => {
        const conf = 0.8;
        const pressure = contradiction_pressure([{ severity: 0.9, confidence: 0.8, unresolved: true }]);
        const after = apply_contradiction_pressure(conf, pressure);
        expect(after).toBeLessThan(conf);
    });

    it('3. unresolved contradiction blocks strict recall', () => {
        const contradictions: Contradiction[] = [
            { id: 'c1', node_a: 'a', node_b: 'b', severity: 0.9, created_at: 0, resolved: false, pressure: 0.7 },
        ];
        const pressure = contradiction_pressure([{ severity: 0.9, confidence: 0.9, unresolved: true }]);
        expect(has_unresolved_contradiction(contradictions)).toBe(true);
        expect(blocks_strict_recall(pressure)).toBe(true);
    });

    it('4. grounded reliable source beats ungrounded weak source', () => {
        const grounded = update_confidence_with_evidence({
            prior: 0.5,
            evidence: [{ source_reliability: 0.95, likelihood_ratio: 6, grounded: true }],
        });
        const weak = update_confidence_with_evidence({
            prior: 0.5,
            evidence: [{ source_reliability: 0.3, likelihood_ratio: 1.5, grounded: false }],
        });
        expect(grounded).toBeGreaterThan(weak);
    });

    it('5. old weak evidence decays', () => {
        const lambda = decay_rate({ base_lambda: 0.1, noise: 0.4, conflict: 0.2, retention: 0.1, reinforcement: 0 });
        const fresh = memory_weight({ w0: 1, lambda, delta_t: 1 });
        const old = memory_weight({ w0: 1, lambda, delta_t: 60 });
        expect(old).toBeLessThan(fresh);
        expect(old).toBeLessThan(0.2);
    });

    it('6. important reinforced memory decays slower than 7. noisy one', () => {
        const important_retention = retention({
            importance: 1.5,
            surprise: 0.5,
            grounding: 1,
            emotional_intensity: 0.5,
            utility: 1,
            confirmation: 1,
            noise: 0,
        });
        const noisy_retention = retention({
            importance: 0.1,
            surprise: 0,
            grounding: 0,
            emotional_intensity: 0,
            utility: 0,
            confirmation: 0,
            noise: 2,
        });

        const important_lambda = decay_rate({ base_lambda: 0.1, noise: 0, conflict: 0, retention: important_retention, reinforcement: 2 });
        const noisy_lambda = decay_rate({ base_lambda: 0.1, noise: 1.5, conflict: 0.5, retention: noisy_retention, reinforcement: 0 });

        expect(important_lambda).toBeLessThan(noisy_lambda);

        const important = memory_weight({ w0: 1, lambda: important_lambda, delta_t: 30 });
        const noisy = memory_weight({ w0: 1, lambda: noisy_lambda, delta_t: 30 });
        expect(important).toBeGreaterThan(noisy);
    });

    it('8. activation increases with repeated use', () => {
        const once = base_activation([2]);
        const many = base_activation([2, 1, 0.5]);
        expect(many).toBeGreaterThan(once);
    });

    it('9. context association changes ranking', () => {
        const base = base_activation([2, 1]);
        const low = activation({ base, context_association: 0.1, task_relevance: 0, grounding_relevance: 0, contradiction_penalty: 0 });
        const high = activation({ base, context_association: 1.2, task_relevance: 0, grounding_relevance: 0, contradiction_penalty: 0 });
        expect(high).toBeGreaterThan(low);

        const via_helper = compute_activation([2, 1], {
            context_association: 1.2,
            task_relevance: 0,
            grounding_relevance: 0,
            contradiction_penalty: 0,
        });
        expect(via_helper).toBeCloseTo(high, 6);
    });

    it('reinforcement pulses raise memory weight', () => {
        const lambda = 0.1;
        const no_pulse = memory_weight({ w0: 1, lambda, delta_t: 20 });
        const with_pulse = memory_weight({ w0: 1, lambda, delta_t: 20, pulses: [{ at_delta: 18, amplitude: 0.5 }] });
        expect(with_pulse).toBeGreaterThan(no_pulse);
    });
});
