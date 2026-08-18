import { describe, expect, it } from 'vitest';
import {
    associative_recall,
    build_context_packet,
    create_hydro_node,
    default_contract,
    default_node_state,
    empty_facets,
    InMemoryRecallIndex,
    manual_provenance,
    memory_evidence_text,
    memory_status_of,
    parse_temporal_preference,
    rank_indices,
    reciprocal_rank_fusion,
    select_diverse,
    type AssociativeScoringWeights,
    type HydroNodeInput,
} from '../src/core/index.js';

const now = 1_700_000_000_000;
const day = 86_400_000;

function make_node(
    id: string,
    text: string,
    over: {
        vector?: number[] | null;
        observed_at?: number;
        claims?: HydroNodeInput['content']['claims'];
        state?: Partial<HydroNodeInput['state']>;
        temporal?: Partial<HydroNodeInput['temporal']>;
        metadata?: Record<string, unknown>;
    } = {},
) {
    const observed_at = over.observed_at ?? now;
    return create_hydro_node({
        id,
        content: { raw: text, canonical: text.toLowerCase(), summary: text, claims: over.claims },
        facets: empty_facets(),
        world: { world_id: 'world:root', parent_world_id: null, zone: 'endocortex', scope_path: ['root'] },
        temporal: { valid_from: observed_at, valid_to: null, observed_at, recorded_at: observed_at, superseded_at: null, ...over.temporal },
        contract: default_contract(),
        grounding: { worlddb_ref: null, source_ids: [], grounding_score: 0 },
        state: { ...default_node_state(), confidence: 0.9, ...over.state },
        vectors: { semantic: over.vector ?? null, type_vector: null, world_vector: null },
        provenance: manual_provenance('tester', observed_at),
        metadata: over.metadata,
    });
}

const only = (over: Partial<AssociativeScoringWeights>): AssociativeScoringWeights => ({
    vector: 0, lexical: 0, entity: 0, activation: 0, spread: 0,
    emotional: 0, speaker: 0, preference: 0, status_penalty: 0, fusion: 0, recency: 0, ...over,
});

describe('phase 31 retrieval quality', () => {
    it('fuses lexical and vector rankings without comparing incompatible score scales', () => {
        const vector_scores = [0.9, 0.1, 0.5];
        const lexical_scores = [0.2, 0.05, 0.9];

        expect(rank_indices(vector_scores)).toEqual([0, 2, 1]);
        const fused = reciprocal_rank_fusion([rank_indices(vector_scores), rank_indices(lexical_scores)], 3);

        expect(fused[0]).toBe(1);
        expect(fused[2]).toBe(1);
        expect(fused[1]).toBeLessThan(fused[0]);
    });

    it('keeps a rank-1 document fused at the top when both signals agree', () => {
        const fused = reciprocal_rank_fusion([[0, 1, 2], [0, 2, 1]], 3);
        expect(fused[0]).toBe(1);
    });

    it('diversifies context so near-duplicate memories cannot crowd out distinct evidence', () => {
        const duplicates = Array.from({ length: 4 }, (_, index) =>
            make_node(`duplicate:${index}`, `the deployment runbook restarts the api gateway step ${index}`, { vector: [1, 0, 0, 0] }));
        const distinct = make_node('rotation', 'the deployment runbook rotates database credentials', { vector: [0, 1, 0, 0] });
        const index = new InMemoryRecallIndex([...duplicates, distinct]);
        const query = { text: 'deployment runbook', now, vector: [1, 0, 0, 0] };

        const diversified = associative_recall(query, { index, diversity: { lambda: 0.5 } });
        const undiversified = associative_recall(query, { index, diversity: { lambda: 1 } });

        expect(diversified.context.items[1].id).toBe('rotation');
        expect(undiversified.context.items[1].id).toMatch(/^duplicate:/);
        expect(diversified.items.map((item) => item.node.id)).toEqual(undiversified.items.map((item) => item.node.id));
    });

    it('detects latest and earliest temporal intent, and ignores neutral questions', () => {
        expect(parse_temporal_preference('which laptop do I use now')).toBe('latest');
        expect(parse_temporal_preference('which laptop did I originally use')).toBe('earliest');
        expect(parse_temporal_preference('which laptop do I use')).toBeNull();
        expect(parse_temporal_preference('was that the first or the most recent laptop')).toBeNull();
    });

    it('ranks the newest fact first for "now" questions and the oldest first for "originally" questions', () => {
        const nodes = [
            make_node('oldest', 'I work on a laptop', { observed_at: now - 200 * day }),
            make_node('middle', 'I work on a laptop', { observed_at: now - 100 * day }),
            make_node('newest', 'I work on a laptop', { observed_at: now - day }),
        ];
        const index = new InMemoryRecallIndex(nodes);
        const weights = only({ recency: 1 });

        const latest = associative_recall({ text: 'which laptop do I use now', now }, { index, weights });
        const earliest = associative_recall({ text: 'which laptop did I originally use', now }, { index, weights });
        const neutral = associative_recall({ text: 'which laptop do I use', now }, { index, weights });

        expect(latest.items.map((item) => item.node.id)).toEqual(['newest', 'middle', 'oldest']);
        expect(earliest.items.map((item) => item.node.id)).toEqual(['oldest', 'middle', 'newest']);
        expect(neutral.items.every((item) => item.breakdown.recency === 0)).toBe(true);
    });

    it('renders evidence with observation date, speaker, and supersession status', () => {
        const superseded = make_node('old', 'I prefer tea', {
            observed_at: Date.UTC(2026, 0, 3),
            temporal: { superseded_at: now },
            state: { status: 'superseded' },
            metadata: { speaker: 'Melanie' },
        });
        const current = make_node('new', 'I prefer coffee', { observed_at: Date.UTC(2026, 4, 9) });

        expect(memory_status_of(superseded)).toBe('superseded');
        expect(memory_evidence_text(superseded)).toBe('[2026-01-03 Melanie superseded] I prefer tea');
        expect(memory_evidence_text(current)).toBe('[2026-05-09] I prefer coffee');
    });

    it('prefers query-relevant claims when rendering evidence', () => {
        const node = make_node('multi', 'trip notes', {
            claims: [
                { kind: 'fact', statement: 'the hotel was in kyoto', subject: 'hotel', predicate: 'located_in', object: 'kyoto', topic: 'located_in:hotel' },
                { kind: 'preference', statement: 'user prefers window seats', subject: 'user', predicate: 'prefers', object: 'window seats', topic: 'preference:general' },
            ],
        });

        const rendered = memory_evidence_text(node, { query_terms: ['window', 'seats'], include_time: false });
        expect(rendered.startsWith('user prefers window seats')).toBe(true);
    });

    it('exposes structured dated evidence alongside the context text', () => {
        const node = make_node('evidence', 'the launch is on friday', { observed_at: Date.UTC(2026, 2, 1) });
        const packet = build_context_packet([{ node }], Number.POSITIVE_INFINITY);

        expect(packet.evidence).toHaveLength(1);
        expect(packet.evidence[0]).toMatchObject({ id: 'evidence', status: 'current', observed_at: Date.UTC(2026, 2, 1) });
        expect(packet.evidence[0].text).toContain('2026-03-01');
        expect(packet.text).toBe('- the launch is on friday');
    });

    it('renders narrative claims as their original sentence instead of predicate scaffolding', () => {
        const node = make_node('narrative', 'car notes', {
            claims: [
                { kind: 'action', statement: "I had an issue with my car's GPS system on 3/22", subject: 'user', predicate: 'action', object: "i had an issue with my car's gps system on 3/22", topic: 'action:user:gps' },
                { kind: 'fact', statement: 'the dealership is in kyoto', subject: 'dealership', predicate: 'located_in', object: 'kyoto', topic: 'located_in:dealership' },
            ],
        });

        const rendered = memory_evidence_text(node, { include_time: false });
        expect(rendered).toContain("I had an issue with my car's GPS system on 3/22");
        expect(rendered).not.toContain('user action');
        expect(rendered).toContain('dealership located_in kyoto');
    });

    it('keeps marginal relevance selection stable when diversity is disabled', () => {
        const items = ['a', 'b', 'c'];
        expect(select_diverse(items, { lambda: 1, similarity: () => 1 })).toEqual(['a', 'b', 'c']);
        expect(select_diverse(items, { lambda: 0.5, limit: 2, similarity: () => 0 })).toEqual(['a', 'b']);
    });
});
