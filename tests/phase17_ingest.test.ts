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
 *  file  : tests/phase17_ingest.test.ts
 *  usage : verifies LongMemory phase17 ingest.test behavior
 */

import { describe, expect, it } from 'vitest';
import {
    IngestEngine,
    IngestTransactionError,
    default_edge_registry,
    type EdgeHandler,
    type GroundingSource,
} from '../src/core/index.js';

const now = 1_700_000_000_000;
const source: GroundingSource = { id: 'worlddb', kind: 'worlddb', reliability: 0.95 };

describe('phase 17 Hydrograph ingest pipeline', () => {
    it('1. simple preference creates semantic/endocortex node', () => {
        const engine = new IngestEngine({ now: () => now });
        const out = engine.ingest({ user_id: 'u1', text: 'I prefer tea', at: now });

        expect(out.node.world.zone).toBe('endocortex');
        expect(out.node.facets.semantic?.value).toBe('I prefer tea');
        expect(out.node.content.raw).toBe('I prefer tea');
        expect(out.node.content.summary).toBe('user prefers tea');
        expect(out.node.content.claims).toEqual([expect.objectContaining({ kind: 'preference', predicate: 'prefers', object: 'tea' })]);
        expect(out.node.contract.use_for_associative_recall).toBe(true);
        expect(Object.isFrozen(out.node)).toBe(true);
        expect(engine.graph.node_count()).toBe(1);
        expect(engine.index.active_nodes(null).map((node) => node.id)).toContain(out.node.id);
    });

    it('2. changed preference creates executable supersedes edge', () => {
        const engine = new IngestEngine({ now: () => now });
        const old = engine.ingest({ user_id: 'u1', text: 'I prefer tea', at: now });
        const current = engine.ingest({ user_id: 'u1', text: 'I now prefer coffee instead of tea', at: now + 1 });
        const edge = current.edges.find((item) => item.type === 'supersedes');

        expect(edge?.from).toBe(current.node.id);
        expect(edge?.to).toBe(old.node.id);
        expect(edge?.handler.handler).toBe('supersedes');
        expect(engine.graph.get_node(old.node.id)?.state.status).toBe('superseded');
        expect(engine.graph.get_node(old.node.id)?.temporal.valid_to).toBe(now + 1);
    });

    it('creates durable conversation adjacency edges', () => {
        const engine = new IngestEngine({ now: () => now });
        const first = engine.ingest({ user_id: 'u1', text: 'What are your summer plans?', speaker: 'Melanie', conversation_id: 'thread-1', at: now });
        const second = engine.ingest({ user_id: 'u1', text: 'I am researching adoption agencies.', speaker: 'Caroline', conversation_id: 'thread-1', at: now + 1 });
        expect(second.edges).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'refers_to', from: second.node.id, to: first.node.id }),
        ]));
        expect(second.node.metadata.conversation_id).toBe('thread-1');
    });

    it('3. contradictory statement creates executable contradicts edge', () => {
        const engine = new IngestEngine({ now: () => now });
        const finland = engine.ingest({ user_id: 'u1', text: 'The server is in Finland', at: now });
        const germany = engine.ingest({ user_id: 'u1', text: 'The server is in Germany', at: now + 1 });
        const edge = germany.edges.find((item) => item.type === 'contradicts');

        expect(edge?.to).toBe(finland.node.id);
        expect(edge?.handler.handler).toBe('contradicts');
        expect(engine.graph.get_node(finland.node.id)?.state.status).toBe('contradicted');
        expect(engine.graph.get_node(germany.node.id)?.state.status).toBe('contradicted');
    });

    it('4. external fact creates bitemporal exocortex node', () => {
        const engine = new IngestEngine({ now: () => now });
        const out = engine.ingest({
            id: 'external:tiger',
            user_id: 'sensor-user',
            text: 'A tiger is in the room',
            at: now,
            observed_at: now - 5,
            valid_from: now - 5,
            external: true,
            source,
            vector: [1, 0, 0, 0, 0, 0, 0, 0],
        });

        expect(out.node.world.zone).toBe('exocortex');
        expect(out.node.temporal.valid_from).toBe(now - 5);
        expect(out.node.temporal.recorded_at).toBe(now);
        expect(out.node.grounding.worlddb_ref).not.toBeNull();
        expect(engine.worlddb.get(out.node.grounding.worlddb_ref!)).not.toBeNull();
    });

    it('5. subjective memory grounds to an external fact', () => {
        const engine = new IngestEngine({ now: () => now });
        const external = engine.ingest({
            id: 'external:tiger', user_id: 'u1', text: 'A tiger is in the room', at: now,
            external: true, source, vector: [1, 0, 0, 0, 0, 0, 0, 0],
        });
        const subjective = engine.ingest({
            user_id: 'u1', text: 'I am afraid because a tiger is in the room', at: now + 1,
            grounding_ref: external.node.grounding.worlddb_ref!,
        });
        const edge = subjective.edges.find((item) => item.type === 'grounds');

        expect(subjective.node.world.zone).toBe('endocortex');
        expect(edge?.to).toBe(external.node.id);
        expect(edge?.handler.handler).toBe('grounds');
        expect(subjective.node.grounding.worlddb_ref).toBe(external.node.grounding.worlddb_ref);
        expect(subjective.node.grounding.grounding_score).toBeGreaterThan(0);
    });

    it('6. entity alias resolves before durable write', () => {
        const engine = new IngestEngine({ now: () => now });
        const alice = engine.resolver.add_entity({
            name: 'Alice Chen', aliases: ['A. Chen'], type: 'person', observed_at: now,
            context: ['project', 'review'],
        });
        const out = engine.ingest({
            user_id: 'u1', text: 'A. Chen reviewed Project Alpha', at: now,
            entity_hints: [{ name: 'A. Chen', type: 'person', context: ['project', 'review'] }],
        });

        expect(out.diff.resolved_entities.some((item) => item.id === alice.id && item.action === 'resolved')).toBe(true);
        const resolution = out.trace.findIndex((step) => step.name === 'entity_resolution');
        const staging = out.trace.findIndex((step) => step.name === 'node_staged');
        expect(resolution).toBeGreaterThanOrEqual(0);
        expect(resolution).toBeLessThan(staging);
        expect(engine.graph.has_node(out.node.id)).toBe(true);
    });

    it('7. failed edge handler rolls back the entire ingest transaction', () => {
        const registry = default_edge_registry();
        const fail: EdgeHandler = {
            type: 'supersedes',
            run(_edge, ctx) {
                ctx.update_node_state(ctx.node_list()[0].id, { confidence: 0.01 });
                throw new Error('forced handler failure');
            },
        };
        registry.register(fail);
        const engine = new IngestEngine({ now: () => now, edge_registry: registry });
        engine.ingest({ user_id: 'u1', text: 'I prefer tea', at: now });

        const before = {
            graph: engine.graph.snapshot(),
            resolver: JSON.stringify(engine.resolver.entity_list()),
            worlds: JSON.stringify(engine.worlds.world_list()),
            worlddb: engine.worlddb.snapshot(),
            index: engine.index.snapshot(),
            sketches: engine.sketches.serialize(),
            working: engine.working.snapshot(),
        };

        expect(() => engine.ingest({
            user_id: 'u1', text: 'I now prefer coffee instead of tea', at: now + 1,
            entity_hints: [{ name: 'Coffee Team', type: 'organization' }],
        })).toThrow(IngestTransactionError);

        expect(engine.graph.node_count()).toBe(before.graph.nodes.size);
        expect(engine.graph.edge_count()).toBe(before.graph.edges.size);
        expect(JSON.stringify(engine.resolver.entity_list())).toBe(before.resolver);
        expect(JSON.stringify(engine.worlds.world_list())).toBe(before.worlds);
        expect(engine.worlddb.snapshot()).toEqual(before.worlddb);
        expect(engine.index.snapshot()).toEqual(before.index);
        expect(engine.sketches.serialize()).toBe(before.sketches);
        expect(engine.working.snapshot()).toEqual(before.working);
    });

    it('rolls back graph, index, and world mutations after commit begins', () => {
        const engine = new IngestEngine({ now: () => now });
        const first = engine.ingest({ user_id: 'u1', text: 'I prefer tea', at: now });
        const before = {
            graph: engine.graph.snapshot(),
            worlds: engine.worlds.snapshot(),
            index: engine.index.snapshot(),
            working: engine.working.snapshot(),
        };
        const add_node_to_world = engine.worlds.add_node_to_world.bind(engine.worlds);
        engine.worlds.add_node_to_world = (world_id, node_id, options) => {
            add_node_to_world(world_id, node_id, options);
            throw new Error('forced post-commit failure');
        };

        expect(() => engine.ingest({ user_id: 'u1', text: 'I now prefer coffee instead of tea', at: now + 1 })).toThrow(IngestTransactionError);
        expect(engine.graph.snapshot()).toEqual(before.graph);
        expect(engine.worlds.snapshot()).toEqual(before.worlds);
        expect(engine.index.snapshot()).toEqual(before.index);
        expect(engine.working.snapshot()).toEqual(before.working);

        engine.worlds.add_node_to_world = add_node_to_world;
        const committed = engine.ingest({ user_id: 'u1', text: 'I now prefer coffee instead of tea', at: now + 2 });
        expect(committed.edges.find((edge) => edge.type === 'supersedes')?.to).toBe(first.node.id);
    });

    it('8. MemoryDiff and trace explain every committed change', () => {
        const engine = new IngestEngine({ now: () => now });
        const old = engine.ingest({ user_id: 'u1', text: 'I prefer tea', at: now });
        const out = engine.ingest({
            id: 'pref:coffee', user_id: 'u1', text: 'I now prefer coffee instead of tea', at: now + 1,
            tags: ['preference', 'beverage'],
        });

        expect(out.diff.created_node_ids).toContain('pref:coffee');
        expect(out.diff.updated_node_ids).toContain(old.node.id);
        expect(out.diff.created_edge_ids).toContain(out.edges.find((edge) => edge.type === 'supersedes')!.id);
        expect(out.diff.index_updates).toEqual(expect.arrayContaining(['pref:coffee', old.node.id]));
        expect(out.diff.sketch_updates).toEqual(expect.arrayContaining(['tags:preference', 'relations:supersedes']));
        expect(out.diff.world_ids).toHaveLength(1);
        expect(out.trace.at(-1)?.name).toBe('memory_diff');
    });
});