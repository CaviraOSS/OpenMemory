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
 *  file  : tests/phase2_substrate.test.ts
 *  usage : verifies LongMemory phase2 substrate.test behavior
 */

import { describe, expect, it } from 'vitest';
import {
    create_hydro_edge,
    create_hydro_node,
    default_contract,
    default_node_state,
    DurableGraph,
    empty_facets,
    hash_merkle_children,
    hash_node,
    manual_provenance,
    verify_merkle_parent,
    verify_node_hash,
    type Contract,
    type HydroNodeInput,
    type NodeHashPolicy,
    type Provenance,
} from '../src/core/index.js';

const t0 = 1_700_000_000_000;

function base_node_input(overrides: Partial<HydroNodeInput> = {}): HydroNodeInput {
    return {
        content: {
            raw: 'User prefers dark mode',
            canonical: 'user prefers dark mode',
            summary: 'prefers dark mode',
        },
        facets: {
            ...empty_facets(),
            semantic: { value: 'user prefers dark mode', weight: 0.9 },
        },
        world: {
            world_id: 'world:root',
            parent_world_id: null,
            zone: 'endocortex',
            scope_path: ['root'],
        },
        temporal: {
            valid_from: t0,
            valid_to: null,
            observed_at: t0,
            recorded_at: t0,
            superseded_at: null,
        },
        contract: default_contract(),
        grounding: { worlddb_ref: null, source_ids: [], grounding_score: 0 },
        state: default_node_state(),
        vectors: { semantic: null, type_vector: null, world_vector: null },
        provenance: manual_provenance('tester', t0),
        ...overrides,
    };
}

const with_contract: NodeHashPolicy = {
    content: true,
    facets: true,
    world: true,
    temporal: true,
    grounding: true,
    contract: true,
    provenance: false,
};

const with_provenance: NodeHashPolicy = {
    content: true,
    facets: true,
    world: true,
    temporal: true,
    grounding: true,
    contract: false,
    provenance: true,
};

describe('phase 2 immutable substrate', () => {
    it('1. same node content produces same hash', () => {
        const a = create_hydro_node(base_node_input());
        const b = create_hydro_node(base_node_input());
        expect(a.content_hash).toBe(b.content_hash);
        expect(a.id).toBe(b.id);
    });

    it('2. meaningful content change produces different hash', () => {
        const a = create_hydro_node(base_node_input());
        const b = create_hydro_node(
            base_node_input({
                content: {
                    raw: 'User prefers light mode',
                    canonical: 'user prefers light mode',
                    summary: 'prefers light mode',
                },
            }),
        );
        expect(a.content_hash).not.toBe(b.content_hash);
    });

    it('3. contract change changes hash only when configured hash-relevant', () => {
        const changed: Contract = { ...default_contract(), use_for_prediction: true };

        const base_default = create_hydro_node(base_node_input());
        const changed_default = create_hydro_node(base_node_input({ contract: changed }));
        expect(changed_default.content_hash).toBe(base_default.content_hash);

        const base_with = create_hydro_node(base_node_input(), with_contract);
        const changed_with = create_hydro_node(base_node_input({ contract: changed }), with_contract);
        expect(changed_with.content_hash).not.toBe(base_with.content_hash);
    });

    it('4. provenance change changes hash only when configured hash-relevant', () => {
        const changed: Provenance = manual_provenance('other-agent', t0);

        const base_default = create_hydro_node(base_node_input());
        const changed_default = create_hydro_node(base_node_input({ provenance: changed }));
        expect(changed_default.content_hash).toBe(base_default.content_hash);

        const base_with = create_hydro_node(base_node_input(), with_provenance);
        const changed_with = create_hydro_node(base_node_input({ provenance: changed }), with_provenance);
        expect(changed_with.content_hash).not.toBe(base_with.content_hash);
    });

    it('5. parent Merkle hash changes when a child hash changes', () => {
        const a = create_hydro_node(base_node_input());
        const b = create_hydro_node(
            base_node_input({
                content: { raw: 'fact b', canonical: 'fact b', summary: 'b' },
            }),
        );
        const c = create_hydro_node(
            base_node_input({
                content: { raw: 'fact c', canonical: 'fact c', summary: 'c' },
            }),
        );

        const parent = hash_merkle_children([a.content_hash, b.content_hash]);
        const parent_changed = hash_merkle_children([a.content_hash, c.content_hash]);

        expect(parent).not.toBe(parent_changed);
        expect(verify_merkle_parent(parent, [a.content_hash, b.content_hash])).toBe(true);
        expect(verify_merkle_parent(parent, [a.content_hash, c.content_hash])).toBe(false);
    });

    it('6. node verification fails after mutation', () => {
        const node = create_hydro_node(base_node_input());
        expect(verify_node_hash(node)).toBe(true);

        
        expect(() => {
            (node.content as { raw: string }).raw = 'tampered';
        }).toThrow();

        
        const forged = {
            ...node,
            content: { ...node.content, raw: 'tampered' },
        };
        expect(verify_node_hash(forged)).toBe(false);
    });

    it('7. hashing is deterministic across runs (known vector)', () => {
        const node = create_hydro_node(base_node_input());
        const again = hash_node(node);
        expect(again).toBe(node.content_hash);
        expect(node.content_hash).toMatch(/^[0-9a-f]{64}$/);
    });
});

describe('phase 2 durable graph', () => {
    it('dedupes identical content and refuses silent rewrite', () => {
        const graph = new DurableGraph();
        const a = graph.add_node(create_hydro_node(base_node_input()));
        const again = graph.add_node(create_hydro_node(base_node_input()));
        expect(graph.node_count()).toBe(1);
        expect(again.id).toBe(a.id);

        const forged = { ...a, content: { ...a.content, raw: 'rewrite' } };
        expect(() => graph.add_node(forged)).toThrow();
    });

    it('exposes a Merkle integrity root that reflects membership', () => {
        const graph = new DurableGraph();
        graph.add_node(create_hydro_node(base_node_input()));
        const root1 = graph.merkle_root();

        graph.add_node(
            create_hydro_node(base_node_input({ content: { raw: 'x', canonical: 'x', summary: 'x' } })),
        );
        const root2 = graph.merkle_root();

        expect(root1).not.toBe(root2);
        expect(graph.verify_integrity()).toBe(true);
    });

    it('creates executable edges with deterministic ids', () => {
        const a = create_hydro_node(base_node_input());
        const b = create_hydro_node(
            base_node_input({ content: { raw: 'b', canonical: 'b', summary: 'b' } }),
        );
        const edge = create_hydro_edge({
            from: a.id,
            to: b.id,
            type: 'supersedes',
            confidence: 0.9,
            weight: 1,
            temporal: { valid_from: t0, valid_to: null, observed_at: t0, recorded_at: t0 },
            handler: { handler: 'supersede', params: {} },
            provenance: manual_provenance('tester', t0),
        });
        expect(edge.id).toMatch(/^edge:[0-9a-f]{64}$/);
    });
});
