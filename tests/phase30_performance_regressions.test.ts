import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { create_memory } from '../src/core/create_memory.js';
import { empty_facets } from '../src/core/types/facets.js';
import { create_hydro_node } from '../src/core/memory/durable_graph.js';
import { default_contract } from '../src/core/types/contract.js';
import { default_node_state } from '../src/core/types/node_state.js';
import { manual_provenance } from '../src/core/types/provenance.js';
import { associative_recall } from '../src/core/recall/associative_recall.js';
import { InMemoryRecallIndex } from '../src/core/recall/candidate_selection.js';
import { EntityResolver } from '../src/core/resolver/entity_resolver.js';
import { strict_recall } from '../src/core/recall/strict_recall.js';
import { historical_recall } from '../src/core/recall/historical_recall.js';

async function ingest_durations(count: number, split = count): Promise<{ first: number; total: number }> {
    const memory = create_memory({ store: 'memory', embedding_provider: () => null as never, embedding_dimension: 8 });
    const started = performance.now();
    let first = 0;
    for (let index = 0; index < count; index++) {
        await memory.ingest({
            user_id: 'performance',
            text: `project topic ${index % 60} item ${index}`,
            at: index + 1,
            observed_at: index + 1,
            world: 'performance',
            conflict_behavior: 'none',
        });
        if (index + 1 === split) first = performance.now() - started;
    }
    const total = performance.now() - started;
    await memory.close();
    return { first, total };
}

describe('core performance regressions', () => {
    it('keeps no-embedding ingestion near-linear through 800 events', async () => {
        await ingest_durations(50);
        const duration = await ingest_durations(800, 400);
        const second = duration.total - duration.first;

        expect(duration.total).toBeLessThan(8_000);
        expect(second / duration.first).toBeLessThan(3);
    }, 15_000);

    it('reuses immutable recall preparation for 768-dimensional vectors', () => {
        const now = 1_700_000_000_000;
        const nodes = Array.from({ length: 700 }, (_, node_index) => create_hydro_node({
            id: `performance:${node_index}`,
            content: {
                raw: `user memory ${node_index} about project topic ${node_index % 40}`,
                canonical: `user memory ${node_index} about project topic ${node_index % 40}`,
                summary: `user action project topic ${node_index % 40}`,
            },
            facets: empty_facets(),
            world: { world_id: 'performance', parent_world_id: null, zone: 'endocortex', scope_path: ['performance'] },
            temporal: { valid_from: now, valid_to: null, observed_at: now - node_index, recorded_at: now, superseded_at: null },
            contract: default_contract(),
            grounding: { worlddb_ref: null, source_ids: [], grounding_score: 0 },
            state: default_node_state(),
            vectors: {
                semantic: Array.from({ length: 768 }, (_, vector_index) => ((node_index + vector_index) % 17) / 17),
                type_vector: null,
                world_vector: null,
            },
            provenance: manual_provenance('performance', now),
        }));
        const index = new InMemoryRecallIndex(nodes);
        const vector = Array.from({ length: 768 }, (_, vector_index) => (vector_index % 17) / 17);
        const query = { text: 'project topic 17', now, world_id: 'performance', vector, k: 20, token_budget: 2_048 };
        for (let iteration = 0; iteration < 3; iteration++) associative_recall(query, { index });

        const started = performance.now();
        let result = associative_recall(query, { index });
        for (let iteration = 1; iteration < 50; iteration++) result = associative_recall(query, { index });
        const duration = performance.now() - started;

        expect(result.items).toHaveLength(20);
        expect(duration).toBeLessThan(3_000);
    }, 10_000);

    it('resolves strongly disambiguated entities without scanning unrelated names', () => {
        const resolver = new EntityResolver({ now: 1 });
        const started = performance.now();
        for (let index = 0; index < 1_000; index++) {
            resolver.resolve({
                name: `Person ${index}`,
                type: 'person',
                context: ['project', 'topic', String(index)],
                observed_at: index + 1,
                metadata: { disambiguator: `identity-${index}` },
            });
        }
        const duration = performance.now() - started;

        expect(resolver.entity_list()).toHaveLength(1_000);
        expect(duration).toBeLessThan(4_000);
    }, 10_000);

    it('keeps transactional entity-heavy ingestion near-linear', async () => {
        const memory = create_memory({ store: 'memory', embedding_provider: () => null as never, embedding_dimension: 8 });
        const started = performance.now();
        for (let index = 0; index < 1_000; index++) {
            await memory.ingest({
                user_id: 'performance',
                text: `entity event ${index}`,
                at: index + 1,
                world: 'entities',
                conflict_behavior: 'none',
                entity_hints: [{
                    name: `Person ${index}`,
                    type: 'person',
                    context: ['project', String(index)],
                    metadata: { disambiguator: `identity-${index}` },
                }],
            });
        }
        const duration = performance.now() - started;
        const stats = await memory.getStats();
        await memory.close();

        expect(stats.entities).toBe(1_000);
        expect(duration).toBeLessThan(6_000);
    }, 10_000);

    it('keeps unique-world creation bounded', async () => {
        const memory = create_memory({ store: 'memory', embedding_provider: () => null as never, embedding_dimension: 8 });
        const started = performance.now();
        for (let index = 0; index < 2_000; index++) {
            await memory.ingest({
                user_id: 'performance',
                text: `world event ${index}`,
                at: index + 1,
                world: `context-${index}`,
                conflict_behavior: 'none',
            });
        }
        const duration = performance.now() - started;
        const stats = await memory.getStats();
        await memory.close();

        expect(stats.worlds).toBe(2_001);
        expect(duration).toBeLessThan(8_000);
    }, 12_000);

    it('keeps strict 768-dimensional recall bounded at 2,000 nodes', () => {
        const now = 1_700_000_000_000;
        const nodes = Array.from({ length: 2_000 }, (_, node_index) => create_hydro_node({
            id: `strict-performance:${node_index}`,
            content: {
                raw: `memory ${node_index} project topic ${node_index % 200}`,
                canonical: `memory ${node_index} project topic ${node_index % 200}`,
                summary: `project topic ${node_index % 200}`,
            },
            facets: empty_facets(),
            world: { world_id: 'strict-performance', parent_world_id: null, zone: 'endocortex', scope_path: ['strict-performance'] },
            temporal: { valid_from: now, valid_to: null, observed_at: now - node_index, recorded_at: now, superseded_at: null },
            contract: default_contract(),
            grounding: { worlddb_ref: null, source_ids: [], grounding_score: 0 },
            state: { ...default_node_state(), confidence: 0.9 },
            vectors: {
                semantic: Array.from({ length: 768 }, (_, vector_index) => ((node_index + vector_index) % 31) / 31),
                type_vector: null,
                world_vector: null,
            },
            provenance: manual_provenance('performance', now),
        }));
        const index = new InMemoryRecallIndex(nodes);
        const vector = Array.from({ length: 768 }, (_, vector_index) => (vector_index % 31) / 31);
        const query = { text: 'project topic 117', now, world_id: 'strict-performance', vector, k: 20, token_budget: 2_048 };
        for (let iteration = 0; iteration < 3; iteration++) strict_recall(query, { index });

        const started = performance.now();
        for (let iteration = 0; iteration < 10; iteration++) strict_recall(query, { index });
        const duration = performance.now() - started;

        const historical_started = performance.now();
        for (let iteration = 0; iteration < 10; iteration++) {
            historical_recall({ text: query.text, now, world_id: query.world_id, valid_time: now }, { index });
        }
        const historical_duration = performance.now() - historical_started;

        expect(duration).toBeLessThan(3_000);
        expect(historical_duration).toBeLessThan(1_500);
    }, 10_000);
});