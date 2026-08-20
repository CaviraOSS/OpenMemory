import { describe, expect, it } from 'vitest';
import {
    create_hydro_node,
    decay_node,
    default_contract,
    default_node_state,
    empty_facets,
    manual_provenance,
    project_node_decay,
    reinforce_node,
} from '../src/core/index.js';

const day = 86_400_000;
const start = Date.UTC(2026, 0, 1);

const node = (grounding = 0, confidence = 0.8) => create_hydro_node({
    content: { raw: 'A durable memory', canonical: 'a durable memory', summary: 'durable memory' },
    facets: { ...empty_facets(), semantic: { value: 'durable memory', weight: 0.8 } },
    world: { world_id: 'world:root', parent_world_id: null, zone: 'endocortex', scope_path: ['root'] },
    temporal: { valid_from: start, valid_to: null, observed_at: start, recorded_at: start, superseded_at: null },
    contract: default_contract(),
    grounding: { worlddb_ref: grounding ? 'fact:1' : null, source_ids: grounding ? ['source:1'] : [], grounding_score: grounding },
    state: { ...default_node_state(), confidence },
    vectors: { semantic: [1, 0], type_vector: null, world_vector: null },
    provenance: manual_provenance('test', start),
});

describe('decay lifecycle', () => {
    it('moves deterministically through warm and cold tiers', () => {
        expect(project_node_decay(node(), start + day).tier).toBe('warm');
        expect(project_node_decay(node(), start + 31 * day).tier).toBe('cold');
    });

    it('produces the same result in one cycle or incremental cycles', () => {
        const original = node();
        const once = decay_node(original, start + 60 * day);
        const halfway = decay_node(original, start + 30 * day);
        const twice = decay_node(halfway, start + 60 * day);
        expect(twice.state.activation).toBeCloseTo(once.state.activation, 12);
        expect(twice.content_hash).toBe(original.content_hash);
    });

    it('retains grounded confident memories longer than noisy memories', () => {
        const grounded = project_node_decay(node(1, 1), start + 60 * day);
        const noisy = project_node_decay(node(0, 0.1), start + 60 * day);
        expect(grounded.retention).toBeGreaterThan(noisy.retention);
        expect(grounded.decay_rate).toBeLessThan(noisy.decay_rate);
        expect(grounded.activation).toBeGreaterThan(noisy.activation);
    });

    it('uses diminishing reinforcement without rewinding time', () => {
        const original = decay_node(node(), start + 20 * day);
        const once = reinforce_node(original, start + 20 * day);
        const twice = reinforce_node(once, start + 10 * day);
        expect(twice.state.last_reinforced_at).toBe(start + 20 * day);
        expect(twice.state.activation - once.state.activation).toBeLessThan(once.state.activation - original.state.activation);
        expect(twice.state.reinforcement_count).toBe(2);
    });

    it('rejects invalid decay configuration', () => {
        expect(() => project_node_decay(node(), start, { cold_lambda: -1 })).toThrow('decay lambdas');
        expect(() => reinforce_node(node(), start, 2)).toThrow('reinforcement amount');
    });
});