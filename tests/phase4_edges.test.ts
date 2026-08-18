import { describe, expect, it } from 'vitest';
import {
    create_hydro_edge,
    create_hydro_node,
    default_contract,
    default_node_state,
    EdgeContext,
    EdgeRegistry,
    empty_facets,
    insert_edge,
    manual_provenance,
    type EdgeHandler,
    type HydroEdgeInput,
    type HydroNodeInput,
    type NodeState,
} from '../src/core/index.js';

const t0 = 1_700_000_000_000;
const mar = t0 + 60 * 86_400_000;

function make_node(
    raw: string,
    opts: { state?: Partial<NodeState>; zone?: 'endocortex' | 'exocortex' } = {},
) {
    const input: HydroNodeInput = {
        content: { raw, canonical: raw.toLowerCase(), summary: raw },
        facets: { ...empty_facets(), semantic: { value: raw, weight: 0.9 } },
        world: {
            world_id: 'world:root',
            parent_world_id: null,
            zone: opts.zone ?? 'endocortex',
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
        state: { ...default_node_state(), ...opts.state },
        vectors: { semantic: null, type_vector: null, world_vector: null },
        provenance: manual_provenance('tester', t0),
    };
    return create_hydro_node(input);
}

function make_edge(
    type: string,
    from: string,
    to: string,
    params: Record<string, unknown> = {},
) {
    const input: HydroEdgeInput = {
        from,
        to,
        type,
        confidence: 0.9,
        weight: 1,
        temporal: { valid_from: mar, valid_to: null, observed_at: mar, recorded_at: mar },
        handler: { handler: type, params },
        provenance: manual_provenance('tester', mar),
    };
    return create_hydro_edge(input);
}

describe('phase 4 executable edge runtime', () => {
    it('1. supersedes edge closes old validity', () => {
        const old_node = make_node('I use Python');
        const new_node = make_node('I use TypeScript');
        const ctx = new EdgeContext({ now: mar, nodes: [old_node, new_node] });

        insert_edge(make_edge('supersedes', new_node.id, old_node.id), ctx);

        const closed = ctx.get_node(old_node.id);
        expect(closed.temporal.valid_to).toBe(mar);
        expect(closed.temporal.superseded_at).toBe(mar);
        expect(closed.state.status).toBe('superseded');
    });

    it('2. contradicts edge creates an unresolved contradiction', () => {
        const a = make_node('server is in Finland');
        const b = make_node('server is in Germany');
        const ctx = new EdgeContext({ now: mar, nodes: [a, b] });

        insert_edge(make_edge('contradicts', a.id, b.id), ctx);

        const unresolved = ctx.unresolved_contradictions();
        expect(unresolved).toHaveLength(1);
        expect(unresolved[0].resolved).toBe(false);
        expect(ctx.get_node(a.id).state.status).toBe('contradicted');
    });

    it('3. supports edge increases confidence', () => {
        const source = make_node('citation');
        const target = make_node('claim', { state: { confidence: 0.5 } });
        const ctx = new EdgeContext({ now: mar, nodes: [source, target] });

        insert_edge(make_edge('supports', source.id, target.id), ctx);

        expect(ctx.get_node(target.id).state.confidence).toBeGreaterThan(0.5);
        expect(ctx.supports_of(target.id)).toContain(source.id);
    });

    it('4. same_as edge updates canonical entity mapping', () => {
        const alias = make_node('A Chen');
        const canonical = make_node('Alice Chen');
        const ctx = new EdgeContext({ now: mar, nodes: [alias, canonical] });

        insert_edge(make_edge('same_as', alias.id, canonical.id), ctx);

        expect(ctx.resolve_entity(alias.id)).toBe(canonical.id);
    });

    it('5. grounds edge updates grounding score', () => {
        const endo = make_node('I fear the tiger is here', { zone: 'endocortex' });
        const world = make_node('tiger left the room', { zone: 'exocortex' });
        const ctx = new EdgeContext({ now: mar, nodes: [endo, world] });

        insert_edge(make_edge('grounds', endo.id, world.id), ctx);

        const grounded = ctx.get_node(endo.id);
        expect(grounded.grounding.grounding_score).toBeGreaterThan(0);
        expect(grounded.grounding.worlddb_ref).toBe(world.id);
    });

    it('6. contains edge changes parent world hash', () => {
        const child = make_node('child fact');
        const ctx = new EdgeContext({ now: mar, nodes: [child] });
        const parent_id = 'world:project';

        const before = ctx.world_merkle_root(parent_id);
        insert_edge(make_edge('contains', parent_id, child.id), ctx);
        const after = ctx.world_merkle_root(parent_id);

        expect(after).not.toBe(before);
    });

    it('7. failed handler rolls back all changes', () => {
        const node = make_node('target', { state: { confidence: 0.5 } });
        const ctx = new EdgeContext({ now: mar, nodes: [node] });

        const boom: EdgeHandler = {
            type: 'boom',
            run(_edge, c) {
                c.update_node_state(node.id, { confidence: 0.99 });
                throw new Error('handler failure');
            },
        };
        const registry = new EdgeRegistry().register(boom);

        expect(() => insert_edge(make_edge('boom', node.id, node.id), ctx, registry)).toThrow(
            'handler failure',
        );
        expect(ctx.get_node(node.id).state.confidence).toBe(0.5);
        expect(ctx.audit_log()).toHaveLength(0);
    });

    it('8. unknown edge type throws a clear error', () => {
        const a = make_node('a');
        const b = make_node('b');
        const ctx = new EdgeContext({ now: mar, nodes: [a, b] });

        expect(() => insert_edge(make_edge('teleports_to', a.id, b.id), ctx)).toThrow(
            /unknown edge type "teleports_to"/,
        );
    });

    it('writes an audit entry and reports affected nodes on success', () => {
        const source = make_node('src');
        const target = make_node('dst', { state: { confidence: 0.4 } });
        const ctx = new EdgeContext({ now: mar, nodes: [source, target] });

        const result = insert_edge(make_edge('supports', source.id, target.id), ctx);

        expect(result.ok).toBe(true);
        expect(result.affected_node_ids).toContain(target.id);
        expect(ctx.audit_log()).toHaveLength(1);
        expect(ctx.audit_log()[0].edge_type).toBe('supports');
    });

    it('derived_from preserves the provenance chain', () => {
        const source = make_node('raw observation');
        const derived = make_node('reflected insight');
        const ctx = new EdgeContext({ now: mar, nodes: [source, derived] });

        insert_edge(make_edge('derived_from', derived.id, source.id), ctx);

        const chain = ctx.get_node(derived.id).provenance.source_trace;
        expect(chain.some((e) => e.source_id === source.id)).toBe(true);
        expect(ctx.sources_of(derived.id)).toContain(source.id);
    });

    it('semantic_shift records drift without overwriting identity', () => {
        const early = make_node('Project Alpha is a hobby');
        const later = make_node('Project Alpha is production infrastructure');
        const ctx = new EdgeContext({ now: mar, nodes: [early, later] });

        insert_edge(make_edge('semantic_shift', early.id, later.id, { note: 'hobby to prod' }), ctx);

        expect(ctx.shifts()).toHaveLength(1);
        
        expect(ctx.get_node(early.id).id).not.toBe(ctx.get_node(later.id).id);
    });
});
