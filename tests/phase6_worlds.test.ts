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
 *  file  : tests/phase6_worlds.test.ts
 *  usage : verifies LongMemory phase6 worlds.test behavior
 */

import { describe, expect, it } from 'vitest';
import {
    create_hydro_node,
    default_contract,
    default_node_state,
    empty_facets,
    WorldGraph,
    type HydroNodeInput,
} from '../src/core/index.js';

const now = 1_700_000_000_000;

function graph(): WorldGraph {
    return new WorldGraph({ now: now, dim: 8, node_vector: () => [1, 0, 0, 0, 0, 0, 0, 0] });
}

function node_with(facets: HydroNodeInput['facets']): HydroNodeInput {
    return {
        content: { raw: 'note', canonical: 'note', summary: 'note' },
        facets,
        world: { world_id: 'world:x', parent_world_id: null, zone: 'endocortex', scope_path: ['x'] },
        temporal: { valid_from: now, valid_to: null, observed_at: now, recorded_at: now, superseded_at: null },
        contract: default_contract(),
        grounding: { worlddb_ref: null, source_ids: [], grounding_score: 0 },
        state: default_node_state(),
        vectors: { semantic: null, type_vector: null, world_vector: null },
        provenance: { created_by: 'tester', extraction_method: 'manual', source_trace: [] },
    };
}

describe('phase 6 recursive worlds', () => {
    it('1. create root world', () => {
        const g = graph();
        const root = g.create_world({ name: 'Root', zone: 'mixed' });
        expect(root.parent_world_id).toBeNull();
        expect(root.scope_path).toEqual(['root']);
        expect(root.content_hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('2. create child world', () => {
        const g = graph();
        const root = g.create_world({ name: 'Root' });
        const child = g.create_child_world(root.id, { name: 'Projects' });
        expect(child.parent_world_id).toBe(root.id);
        expect(child.scope_path).toEqual(['root', 'projects']);
        expect(g.get_world(root.id)?.child_world_ids).toContain(child.id);
    });

    it('3. add node to child world', () => {
        const g = graph();
        const root = g.create_world({ name: 'Root' });
        const child = g.create_child_world(root.id, { name: 'Projects' });
        g.add_node_to_world(child.id, 'node:1');
        expect(g.get_world(child.id)?.node_refs).toContain('node:1');
        expect(g.primary_world_of('node:1')).toBe(child.id);
    });

    it('4. parent hash changes after child update', () => {
        const g = graph();
        const root = g.create_world({ name: 'Root' });
        const child = g.create_child_world(root.id, { name: 'Projects' });
        const before = g.get_world(root.id)!.content_hash;
        g.add_node_to_world(child.id, 'node:1');
        const after = g.get_world(root.id)!.content_hash;
        expect(after).not.toBe(before);
    });

    it('5. node with multiple facets is valid', () => {
        const facets = {
            ...empty_facets(),
            semantic: { value: 'a fact', weight: 0.9 },
            emotional: { value: 'felt proud', weight: 0.6 },
        };
        const node = create_hydro_node(node_with(facets));
        expect(node.facets.semantic).not.toBeNull();
        expect(node.facets.emotional).not.toBeNull();
        expect(node.content_hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('6. moving a node preserves history', () => {
        const g = graph();
        const root = g.create_world({ name: 'Root' });
        const a = g.create_child_world(root.id, { name: 'Inbox' });
        const b = g.create_child_world(root.id, { name: 'Archive' });
        g.add_node_to_world(a.id, 'node:1');

        g.move_node_between_worlds('node:1', a.id, b.id);

        expect(g.get_world(a.id)?.node_refs).not.toContain('node:1');
        expect(g.get_world(b.id)?.node_refs).toContain('node:1');
        const history = g.placement_history_for('node:1');
        expect(history.some((p) => p.from_world_id === a.id && p.to_world_id === b.id)).toBe(true);
        
        expect(history.length).toBeGreaterThanOrEqual(2);
    });

    it('7. query world subtree returns correct nodes', () => {
        const g = graph();
        const root = g.create_world({ name: 'Root' });
        const child = g.create_child_world(root.id, { name: 'Projects' });
        const grandchild = g.create_child_world(child.id, { name: 'Alpha' });
        g.add_node_to_world(root.id, 'node:root');
        g.add_node_to_world(child.id, 'node:child');
        g.add_node_to_world(grandchild.id, 'node:grand');

        const subtree = g.query_world_subtree(root.id);
        expect(subtree.node_ids).toEqual(['node:child', 'node:grand', 'node:root']);
        expect(subtree.world_ids).toContain(grandchild.id);

        const child_subtree = g.query_world_subtree(child.id);
        expect(child_subtree.node_ids).toEqual(['node:child', 'node:grand']);
    });

    it('8. world contracts are inherited or overridden correctly', () => {
        const g = graph();
        const root = g.create_world({ name: 'Root', contracts: { use_for_prediction: true } });
        const child = g.create_child_world(root.id, {
            name: 'Sensitive',
            contracts: { use_for_personalization: false, requires_grounding: true },
        });
        const grandchild = g.create_child_world(child.id, {
            name: 'Override',
            contracts: { requires_grounding: false },
        });

        const root_contract = g.resolve_contracts(root.id);
        expect(root_contract.use_for_prediction).toBe(true); 

        const child_contract = g.resolve_contracts(child.id);
        expect(child_contract.use_for_prediction).toBe(true); 
        expect(child_contract.requires_grounding).toBe(true); 

        const grand_contract = g.resolve_contracts(grandchild.id);
        expect(grand_contract.use_for_prediction).toBe(true); 
        expect(grand_contract.requires_grounding).toBe(false); 
    });

    it('composes a normalized world embedding bottom-up', () => {
        const g = graph();
        const root = g.create_world({ name: 'Root', ontology: { types: ['project'], terms: ['memory'] } });
        const child = g.create_child_world(root.id, { name: 'Projects' });
        g.add_node_to_world(child.id, 'node:1');

        const vector = g.compose_world_embedding(root.id);
        const norm = Math.sqrt(vector.reduce((s, x) => s + x * x, 0));
        expect(vector).toHaveLength(8);
        expect(norm).toBeCloseTo(1, 5);
        expect(g.get_world(child.id)?.world_vector).not.toBeNull();
    });
});
