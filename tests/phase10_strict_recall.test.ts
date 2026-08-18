import { describe, expect, it } from 'vitest';
import {
    create_hydro_node,
    default_contract,
    default_node_state,
    empty_facets,
    InMemoryRecallIndex,
    strict_recall,
    type Contract,
    type HydroNodeInput,
    type NodeState,
    type RecallDeps,
} from '../src/core/index.js';

const now = 1_700_000_000_000;
const day = 86_400_000;

function make_node(
    id: string,
    text: string,
    over: {
        contract?: Partial<Contract>;
        state?: Partial<NodeState>;
        temporal?: Partial<HydroNodeInput['temporal']>;
        grounding?: Partial<HydroNodeInput['grounding']>;
        facets?: HydroNodeInput['facets'];
        vector?: number[] | null;
        with_source?: boolean;
    } = {},
) {
    const input: HydroNodeInput = {
        id,
        content: { raw: text, canonical: text.toLowerCase(), summary: text },
        facets: over.facets ?? empty_facets(),
        world: { world_id: 'world:root', parent_world_id: null, zone: 'endocortex', scope_path: ['root'] },
        temporal: { valid_from: now, valid_to: null, observed_at: now, recorded_at: now, superseded_at: null, ...over.temporal },
        contract: { ...default_contract(), ...over.contract },
        grounding: { worlddb_ref: null, source_ids: [], grounding_score: 0, ...over.grounding },
        state: { ...default_node_state(), confidence: 0.9, ...over.state },
        vectors: { semantic: over.vector ?? null, type_vector: null, world_vector: null },
        provenance: {
            created_by: 'tester',
            extraction_method: 'manual',
            source_trace: over.with_source === false ? [] : [{ source_id: 's1', ref: null, at: now }],
        },
    };
    return create_hydro_node(input);
}

function deps(hot: ReturnType<typeof make_node>[], cold: ReturnType<typeof make_node>[] = []): {
    index: InMemoryRecallIndex;
    recall: RecallDeps;
} {
    const index = new InMemoryRecallIndex(hot, cold);
    return { index, recall: { index } };
}

describe('phase 10 strict recall engine', () => {
    it('1/2. current preference recalled, superseded preference is not', () => {
        const old_pref = make_node('old', 'I prefer tea', {
            temporal: { valid_to: now + 30 * day, superseded_at: now + 30 * day },
            state: { status: 'superseded' },
        });
        const new_pref = make_node('new', 'I prefer coffee', { temporal: { valid_from: now + 30 * day, observed_at: now + 30 * day } });
        const { index, recall } = deps([old_pref, new_pref]);

        const res = strict_recall({ text: 'what do I prefer', now: now + 60 * day }, recall);
        const ids = res.items.map((i) => i.node.id);
        expect(ids).toContain('new');
        expect(ids).not.toContain('old');
        expect(index.cold_scans).toBe(0);
    });

    it('3. contradicted memory is blocked', () => {
        const n = make_node('c', 'server is in Finland', { state: { status: 'contradicted' } });
        const { recall } = deps([n]);
        const res = strict_recall({ text: 'where is the server', now: now }, recall);
        expect(res.items.map((i) => i.node.id)).not.toContain('c');
        expect(res.trace.candidates.find((c) => c.id === 'c')?.reasons).toContain('contradicted');
    });

    it('4. ungrounded required-grounding memory is blocked', () => {
        const n = make_node('g', 'the capital is X', { contract: { requires_grounding: true }, grounding: { grounding_score: 0 } });
        const { recall } = deps([n]);
        const res = strict_recall({ text: 'what is the capital', now: now }, recall);
        expect(res.items.length).toBe(0);
        expect(res.trace.candidates.find((c) => c.id === 'g')?.reasons.some((r) => r.includes('grounding'))).toBe(true);
    });

    it('5. low-confidence memory is blocked', () => {
        const n = make_node('lc', 'maybe the meeting is friday', { state: { confidence: 0.2 } });
        const { recall } = deps([n]);
        const res = strict_recall({ text: 'when is the meeting', now: now }, recall);
        expect(res.items.length).toBe(0);
    });

    it('6. relevant active memory is returned', () => {
        const n = make_node('a', 'the launch meeting is on friday', { state: { confidence: 0.9 } });
        const { recall } = deps([n]);
        const res = strict_recall({ text: 'when is the launch meeting', now: now }, recall);
        expect(res.items.map((i) => i.node.id)).toContain('a');
    });

    it('7. explain trace shows accepted and rejected candidates', () => {
        const good = make_node('good', 'active fact about the project', { state: { confidence: 0.9 } });
        const bad = make_node('bad', 'superseded fact about the project', {
            temporal: { superseded_at: now + day },
            state: { status: 'superseded' },
        });
        const { recall } = deps([good, bad]);
        const res = strict_recall({ text: 'project fact', now: now + 2 * day }, recall);

        const good_trace = res.trace.candidates.find((c) => c.id === 'good');
        const bad_trace = res.trace.candidates.find((c) => c.id === 'bad');
        expect(good_trace?.accepted).toBe(true);
        expect(bad_trace?.accepted).toBe(false);
        expect(bad_trace?.reasons.length).toBeGreaterThan(0);
        expect(res.trace.retrieved).toBe(2);
    });

    it('8. context packet stays under budget', () => {
        const nodes = Array.from({ length: 10 }, (_, i) =>
            make_node(`n${i}`, `active fact number ${i} about the project and its long detailed description`, { state: { confidence: 0.9 } }),
        );
        const { recall } = deps(nodes);
        const res = strict_recall({ text: 'project fact', now: now, token_budget: 20 }, recall);
        expect(res.context.tokens_used).toBeLessThanOrEqual(20);
        expect(res.context.within_budget).toBe(true);
    });

    it('9. fast strict recall does not scan cold logs', () => {
        const hot = [make_node('h', 'active hot fact', { state: { confidence: 0.9 } })];
        const cold = [make_node('c', 'old cold log entry', { state: { confidence: 0.9 } })];
        const { index, recall } = deps(hot, cold);
        const res = strict_recall({ text: 'fact', now: now }, recall);
        expect(index.cold_scans).toBe(0);
        expect(res.trace.cold_scans).toBe(0);
        expect(res.items.map((i) => i.node.id)).not.toContain('c');
    });

    it('embeddings never override validity gates', () => {
        // Superseded node with a perfect embedding match must still be rejected.
        const q = [1, 0, 0, 0];
        const superseded = make_node('s', 'I prefer tea', {
            vector: q,
            temporal: { superseded_at: now + day },
            state: { status: 'superseded' },
        });
        const active = make_node('a', 'I prefer coffee', { vector: [0, 1, 0, 0], state: { confidence: 0.9 } });
        const { recall } = deps([superseded, active]);
        const res = strict_recall({ text: 'preference', now: now + 2 * day, vector: q }, recall);
        expect(res.items.map((i) => i.node.id)).toEqual(['a']);
    });
});
