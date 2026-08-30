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
 *  file  : tests/phase31_retrieval_quality.test.ts
 *  usage : verifies LongMemory phase31 retrieval quality.test behavior
 */

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
    matrix_fusion,
    memory_status_of,
    parse_temporal_preference,
    rank_indices,
    reciprocal_rank_fusion,
    select_evidence_set,
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
    it('selects complementary aspects and an exception under a token budget', () => {
        const items = [
            { id: 'smooth', score: 1, terms: new Set(['car', 'project', 'smooth']), polarity: 0, cost: 4 },
            { id: 'duplicate', score: 0.95, terms: new Set(['car', 'project', 'smooth']), polarity: 0, cost: 4 },
            { id: 'failure', score: 0.7, terms: new Set(['car', 'project', 'issue']), polarity: 1, cost: 4 },
        ];
        const selected = select_evidence_set(items, {
            limit: 2,
            token_budget: 8,
            query_terms: ['car', 'project', 'smooth'],
            exception_query: true,
            terms: (item) => item.terms,
            similarity: (left, right) => left.id === right.id || left.id !== 'failure' && right.id !== 'failure' ? 1 : 0,
            token_cost: (item) => item.cost,
            polarity: (item) => item.polarity,
            relevance: (item) => item.score,
        });

        expect(selected.map((item) => item.id)).toEqual(['smooth', 'failure']);
    });

    it('calibrates correlated signals while preserving a strong independent channel', () => {
        const result = matrix_fusion([
            { name: 'vector', values: [0.51, 0.52, 0.53, 0.75], weight: 0.4 },
            { name: 'lexical', values: [0.2, 0.4, 0.6, 0.1], weight: 0.35 },
            { name: 'duplicate', values: [0.2, 0.4, 0.6, 0.1], weight: 0.25 },
        ]);

        expect(result.scores.every(Number.isFinite)).toBe(true);
        expect(Math.max(...result.scores)).toBe(1);
        expect(result.scores[3]).toBe(1);
        expect(result.covariance).toHaveLength(3);
    });

    it('never promotes a uniformly weak candidate through covariance rotation', () => {
        const result = matrix_fusion([
            { name: 'vector', values: [0.8, 0.6, 0.2], weight: 0.4 },
            { name: 'lexical', values: [0.9, 0.5, 0.1], weight: 0.35 },
            { name: 'activation', values: [0.7, 0.4, 0.05], weight: 0.25 },
        ]);

        expect(result.scores[0]).toBeGreaterThan(result.scores[1]);
        expect(result.scores[1]).toBeGreaterThan(result.scores[2]);
    });

    it('handles constant and binary feature columns deterministically', () => {
        const first = matrix_fusion([
            { name: 'constant', values: [1, 1, 1], weight: 0.5 },
            { name: 'speaker', values: [0, 1, 0], weight: 0.5 },
        ]);
        const second = matrix_fusion([
            { name: 'constant', values: [1, 1, 1], weight: 0.5 },
            { name: 'speaker', values: [0, 1, 0], weight: 0.5 },
        ]);

        expect([...first.scores]).toEqual([...second.scores]);
        expect(first.scores[1]).toBeGreaterThan(first.scores[0]);
    });

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
        expect(rendered).not.toContain('hotel located_in kyoto');
    });

    it('keeps complementary clauses after the query-matching claim', () => {
        const node = make_node('starbucks', "John did not want Starbucks because he preferred beer", {
            claims: [
                { kind: 'action', statement: "Why Starbucks", subject: 'john', predicate: 'action', object: 'why starbucks', topic: 'action:john:starbucks' },
                { kind: 'preference', statement: 'Maybe we can have a beer somewhere', subject: 'john', predicate: 'prefers', object: 'beer', topic: 'preference:john:beer' },
            ],
        });

        expect(memory_evidence_text(node, { query_terms: ['why', 'starbucks'], include_time: false }))
            .toBe('Why Starbucks; john prefers beer');
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
