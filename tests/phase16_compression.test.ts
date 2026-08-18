import { describe, expect, it } from 'vitest';
import {
    CountMinSketch,
    FrequentDirections,
    MemorySketches,
    OjaTracker,
    create_hydro_node,
    default_contract,
    default_node_state,
    empty_facets,
    InMemoryRecallIndex,
    manual_provenance,
    strict_recall,
    type HydroNodeInput,
} from '../src/core/index.js';

const now = 1_700_000_000_000;

function memory(id: string, text: string, superseded = false) {
    const input: HydroNodeInput = {
        id,
        content: { raw: text, canonical: text.toLowerCase(), summary: text },
        facets: empty_facets(),
        world: { world_id: 'world:root', parent_world_id: null, zone: 'endocortex', scope_path: ['root'] },
        temporal: {
            valid_from: now,
            valid_to: superseded ? now + 1 : null,
            observed_at: now,
            recorded_at: now,
            superseded_at: superseded ? now + 1 : null,
        },
        contract: default_contract(),
        grounding: { worlddb_ref: null, source_ids: [], grounding_score: 0 },
        state: { ...default_node_state(), status: superseded ? 'superseded' : 'active' },
        vectors: { semantic: null, type_vector: null, world_vector: null },
        provenance: manual_provenance('tester', now),
    };
    return create_hydro_node(input);
}

describe('phase 16 compression and sketch layer', () => {
    it('1. Count-Min estimates repeated entities', () => {
        const sketch = new CountMinSketch(256, 5);
        for (let i = 0; i < 100; i++) sketch.add('entity:alice');
        for (let i = 0; i < 7; i++) sketch.add('entity:bob');

        expect(sketch.estimate('entity:alice')).toBeGreaterThanOrEqual(100);
        expect(sketch.estimate('entity:alice')).toBeGreaterThan(sketch.estimate('entity:bob'));
        expect(sketch.cells).toBe(1280);
    });

    it('2. sketches merge and round-trip through serialization', () => {
        const left = new MemorySketches({ width: 128, depth: 4, vector_dimension: 3, world_rows: 2 });
        const right = new MemorySketches({ width: 128, depth: 4, vector_dimension: 3, world_rows: 2 });
        left.add('entities', 'alice', 4).update_world('work', [1, 0, 0]).update_drift('project', [1, 0, 0]);
        right.add('entities', 'alice', 6).update_world('work', [0.9, 0.1, 0]).update_drift('project', [0, 1, 0]);

        left.merge(right);
        const restored = MemorySketches.deserialize(left.serialize());

        expect(restored.estimate('entities', 'alice')).toBeGreaterThanOrEqual(10);
        expect(restored.world_sketch('work')?.size).toBeLessThanOrEqual(2);
        expect(restored.drift_tracker('project')?.observations).toBe(2);
    });

    it('3. Frequent Directions matrix remains bounded', () => {
        const sketch = new FrequentDirections(6, 3);
        for (let i = 0; i < 100; i++) {
            sketch.update(Array.from({ length: 6 }, (_, column) => Math.sin(i + column)));
            expect(sketch.matrix.length).toBeLessThanOrEqual(3);
        }
        const restored = FrequentDirections.deserialize(sketch.serialize());
        const merged = new FrequentDirections(6, 3).merge(restored).merge(restored);

        expect(restored.matrix.length).toBeLessThanOrEqual(3);
        expect(merged.matrix.length).toBeLessThanOrEqual(3);
        expect(restored.concept_vector()).toHaveLength(6);
    });

    it('4. Oja update changes concept vector gradually', () => {
        const tracker = new OjaTracker(2, { learning_rate: 0.05, initial: [1, 1] });
        const before = tracker.vector;
        tracker.update([0, 1]);
        const once = tracker.vector;
        for (let i = 0; i < 50; i++) tracker.update([0, 1]);
        const later = tracker.vector;

        expect(once).not.toEqual(before);
        expect(once[0]).toBeGreaterThan(0);
        expect(once[1]).toBeLessThan(1);
        expect(later[1]).toBeGreaterThan(once[1]);
        expect(OjaTracker.deserialize(tracker.serialize()).vector).toEqual(tracker.vector);
    });

    it('5. sketch frequency improves candidate pruning', () => {
        const sketches = new MemorySketches({ width: 256, depth: 4 });
        sketches.add('patterns', 'relevant-pattern', 100);
        const candidates = Array.from({ length: 100 }, (_, index) => ({
            id: index === 99 ? 'relevant' : `noise:${index}`,
            keys: [index === 99 ? 'relevant-pattern' : `noise-pattern:${index}`],
            base_score: index === 99 ? 0.01 : 0.1 - index / 2000,
            value: index,
        }));
        const baseline = [...candidates].sort((left, right) => right.base_score - left.base_score).slice(0, 10);
        const pruned = sketches.prune_candidates(candidates, 10, 'patterns', 0.5);

        expect(baseline.some((item) => item.id === 'relevant')).toBe(false);
        expect(pruned.some((item) => item.id === 'relevant')).toBe(true);
        expect(pruned).toHaveLength(10);
    });

    it('6. approximate sketch cannot resurrect superseded strict facts', () => {
        const current = memory('current', 'the server is currently in Sweden');
        const stale = memory('stale', 'the server used to be in Finland', true);
        const index = new InMemoryRecallIndex([stale, current]);

        const recalled = strict_recall(
            { text: 'where is the server', now: now + 2 },
            {
                index,
                // Deliberately adversarial approximation: stale would get the maximum boost.
                sketch_relevance_of: (node) => node.id === stale.id ? 10_000 : 0,
            },
        );
        const ids = recalled.items.map((item) => item.node.id);

        expect(ids).toContain(current.id);
        expect(ids).not.toContain(stale.id);
        expect(recalled.trace.candidates.find((item) => item.id === stale.id)?.accepted).toBe(false);
    });
});