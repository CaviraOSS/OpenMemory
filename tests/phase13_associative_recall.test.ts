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
 *  file  : tests/phase13_associative_recall.test.ts
 *  usage : verifies LongMemory phase13 associative recall.test behavior
 */

import { describe, expect, it } from 'vitest';
import {
    associative_recall,
    create_hydro_node,
    default_contract,
    default_node_state,
    empty_facets,
    hopfield_recall,
    InMemoryRecallIndex,
    manual_provenance,
    parse_query_intent,
    spread_activation,
    strict_recall,
    type AssociativeDeps,
    type Contract,
    type Facets,
    type HydroEdge,
    type HydroNodeInput,
    type NodeState,
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
        facets?: Facets;
        vector?: number[] | null;
        claims?: HydroNodeInput['content']['claims'];
        metadata?: Record<string, unknown>;
    } = {},
) {
    const input: HydroNodeInput = {
        id,
        content: { raw: text, canonical: text.toLowerCase(), summary: text, claims: over.claims },
        facets: over.facets ?? empty_facets(),
        world: { world_id: 'world:root', parent_world_id: null, zone: 'endocortex', scope_path: ['root'] },
        temporal: { valid_from: now, valid_to: null, observed_at: now, recorded_at: now, superseded_at: null, ...over.temporal },
        contract: { ...default_contract(), ...over.contract },
        grounding: { worlddb_ref: null, source_ids: [], grounding_score: 0 },
        state: { ...default_node_state(), confidence: 0.9, ...over.state },
        vectors: { semantic: over.vector ?? null, type_vector: null, world_vector: null },
        provenance: manual_provenance('tester', now),
        metadata: over.metadata,
    };
    return create_hydro_node(input);
}

function edge(id: string, from: string, to: string): HydroEdge {
    return {
        id,
        from,
        to,
        type: 'associates',
        confidence: 1,
        weight: 1,
        temporal: { valid_from: now, valid_to: null, observed_at: now, recorded_at: now },
        handler: { handler: null, params: {} },
        provenance: manual_provenance('tester', now),
    };
}

function emotional(value: string, weight = 0.8): Facets {
    return { ...empty_facets(), emotional: { value, weight } };
}

describe('phase 13 associative recall engine', () => {
    it('1. old emotional memory appears associatively', () => {
        const joy = make_node('joy', 'I felt joy at the beach with my dog', {
            temporal: { observed_at: now - 400 * day },
            state: { confidence: 0.7 },
            facets: emotional('joy'),
        });
        const deps: AssociativeDeps = { index: new InMemoryRecallIndex([joy]) };

        const res = associative_recall({ text: 'beach dog', now: now }, deps);
        const item = res.items.find((i) => i.node.id === 'joy');
        expect(item).toBeDefined();
        expect(item!.label).toBe('emotional_residue');
    });

    it('2. superseded memory appears only with a status label', () => {
        const old = make_node('berlin', 'I used to live in Berlin near the river', {
            temporal: { superseded_at: now - 10 * day },
            state: { status: 'superseded' },
        });
        const deps: AssociativeDeps = { index: new InMemoryRecallIndex([old]) };

        const res = associative_recall({ text: 'where did I live river', now: now }, deps);
        const item = res.items.find((i) => i.node.id === 'berlin');
        expect(item).toBeDefined();
        expect(item!.label).toBe('superseded');

        expect(res.trace.candidates.find((c) => c.id === 'berlin')?.label).toBe('superseded');
    });

    it('3. associative recall does not affect strict recall', () => {
        const current = make_node('cur', 'I prefer coffee in the morning');
        const superseded = make_node('old', 'I prefer tea in the morning', {
            temporal: { superseded_at: now - day },
            state: { status: 'superseded' },
        });
        const index = new InMemoryRecallIndex([current, superseded]);

        const before = strict_recall({ text: 'what do I prefer in the morning', now: now }, { index }).items.map((i) => i.node.id);

        const assoc = associative_recall({ text: 'what do I prefer in the morning', now: now }, { index });

        expect(assoc.items.map((i) => i.node.id)).toContain('old');
        expect(assoc.items.find((i) => i.node.id === 'old')!.label).toBe('superseded');


        const after = strict_recall({ text: 'what do I prefer in the morning', now: now }, { index }).items.map((i) => i.node.id);
        expect(after).toEqual(before);
        expect(after).not.toContain('old');
    });

    it('4. spreading activation stops at max depth', () => {
        const edges: HydroEdge[] = [edge('e:ab', 'A', 'B'), edge('e:bc', 'B', 'C'), edge('e:cd', 'C', 'D')];
        const seeds = new Map<string, number>([['A', 1]]);

        const res = spread_activation(seeds, edges, { max_hops: 2, alpha: 0.8 });

        expect(res.visited).toContain('A');
        expect(res.visited).toContain('B');
        expect(res.visited).toContain('C');
        expect(res.visited).not.toContain('D');
        expect(res.activation.has('D')).toBe(false);
    });

    it('keeps graph seeds sparse and reports matrix diagnostics', () => {
        const nodes = [
            make_node('A', 'shared topic alpha'),
            make_node('B', 'shared topic beta'),
            make_node('C', 'shared topic gamma'),
        ];
        const edges: HydroEdge[] = [edge('e:ab', 'A', 'B'), edge('e:bc', 'B', 'C')];
        const result = associative_recall({ text: 'Do all shared topic cases work?', now }, { index: new InMemoryRecallIndex(nodes), edges });

        expect(result.trace.spread.seeds).toBe(1);
        expect(result.trace.spread.seed_density).toBeCloseTo(1 / 3);
        expect(result.trace.spread.visited).toBeLessThanOrEqual(3);
        expect(result.trace.matrix.enabled).toBe(true);
        expect(result.trace.matrix.features).toEqual(expect.arrayContaining(['vector', 'lexical', 'activation']));
    });

    it('bundles preceding conversation turns for referential evidence', () => {
        const previous = make_node('previous', 'Caroline: Did you take the nature walk after the road trip?', {
            metadata: { conversation_id: 'trip', speaker: 'Caroline' },
        });
        const answer = make_node('answer', 'Melanie: We just did it yesterday and it was a nice way to relax', {
            metadata: { conversation_id: 'trip', speaker: 'Melanie' },
        });
        const edges: HydroEdge[] = [{ ...edge('e:answer:previous', 'answer', 'previous'), type: 'refers_to' }];
        const result = associative_recall(
            { text: 'What did Melanie do to relax?', now, token_budget: 200 },
            { index: new InMemoryRecallIndex([previous, answer]), edges },
        );
        const evidence = result.context.evidence.find((item) => item.id === 'answer');

        expect(evidence?.text).toContain('Did you take the nature walk');
        expect(evidence?.text).toContain('We just did it yesterday');
        expect(result.context.bundled_items).toBeGreaterThan(0);
    });

    it('5. irrelevant graph neighbourhoods do not flood context', () => {
        const seed = make_node('seed', 'quantum physics entanglement research', { vector: [1, 0, 0] });
        const near = make_node('near', 'quantum physics lab notes', { vector: [0.9, 0.1, 0] });

        const irr1 = make_node('irr1', 'chocolate cake recipe with butter', { vector: [0, 1, 0] });
        const irr2 = make_node('irr2', 'best pasta sauce cooking tips', { vector: [0, 1, 0] });
        const edges: HydroEdge[] = [edge('e:sn', 'seed', 'near'), edge('e:ii', 'irr1', 'irr2')];

        const deps: AssociativeDeps = {
            index: new InMemoryRecallIndex([seed, near, irr1, irr2]),
            edges,
            spread: { max_hops: 2 },
        };

        const res = associative_recall({ text: 'quantum physics', now: now, vector: [1, 0, 0], token_budget: 20 }, deps);

        const context_ids = res.context.items.map((n) => n.id);
        expect(context_ids).toContain('seed');
        expect(context_ids).not.toContain('irr1');
        expect(context_ids).not.toContain('irr2');

        expect(res.trace.spread.visited).toBeLessThan(4);
    });

    it('6. hopfield recall returns a pattern-similar memory, not a strict fact', () => {
        const memories = [
            { id: 'A', key: [1, 0, 0], value: [1, 0, 0] },
            { id: 'B', key: [0, 1, 0], value: [0, 1, 0] },
            { id: 'C', key: [0, 0, 1], value: [0, 0, 1] },
        ];
        const res = hopfield_recall([0.1, 0.9, 0], memories, 10);
        expect(res.best?.id).toBe('B');


        const fact = make_node('fact', 'the office is on floor two', { vector: [1, 0] });
        const old_pattern = make_node('memory', 'a rainy day at the old office', {
            temporal: { superseded_at: now - day },
            state: { status: 'superseded' },
            vector: [0, 1],
        });
        const deps: AssociativeDeps = {
            index: new InMemoryRecallIndex([fact, old_pattern]),
            hopfield: { enabled: true, beta: 12 },
        };
        const assoc = associative_recall({ text: 'rainy office', now: now, vector: [0.05, 0.95] }, deps);
        expect(assoc.hopfield?.best?.id).toBe('memory');
    });

    it('7. rare query terms receive proper BM25 IDF weight', () => {
        const relevant = make_node('relevant', 'routine notes mention zephyrtoken once');
        const common = make_node('common', 'routine notes routine notes routine notes');
        const other = make_node('other', 'routine notes about an unrelated topic');
        const result = associative_recall(
            { text: 'routine zephyrtoken', now, vector: null },
            { index: new InMemoryRecallIndex([common, other, relevant]), weights: { vector: 0, lexical: 1, entity: 0, activation: 0, spread: 0, emotional: 0, speaker: 0, preference: 0, status_penalty: 0 } },
        );
        expect(result.items[0].node.id).toBe('relevant');
        expect(result.items[0].breakdown.lexical).toBeGreaterThan(result.items[1].breakdown.lexical);
    });

    it('8. ignores interrogatives as entities and conditions emotional boosts on relevance', () => {
        expect(parse_query_intent({ text: 'What happened to Maya?', now })).toMatchObject({ entity_names: ['Maya'] });
        const relevant = make_node('relevant', 'Maya repaired the bicycle');
        const irrelevant = make_node('irrelevant', 'I was delighted about a beach holiday', { facets: emotional('delighted', 1) });
        const result = associative_recall({ text: 'What happened to Maya?', now, vector: null }, { index: new InMemoryRecallIndex([irrelevant, relevant]) });
        expect(result.items[0].node.id).toBe('relevant');
        expect(result.items.find((item) => item.node.id === 'irrelevant')?.breakdown.emotional).toBe(0);
    });

    it('9. slightly prefers direct user memories for first-person questions', () => {
        const assistant = make_node('assistant', 'The boots need to be picked up', { state: { salience: 0.5 } });
        const user = make_node('user', 'The boots need to be picked up', { state: { salience: 0.5 } });
        const with_roles = [
            create_hydro_node({ ...assistant, id: 'assistant-role', metadata: { role: 'assistant' } }),
            create_hydro_node({ ...user, id: 'user-role', metadata: { role: 'user' } }),
        ];
        const result = associative_recall({ text: 'What do I need to pick up?', now, vector: null }, { index: new InMemoryRecallIndex(with_roles) });
        expect(result.items[0].node.id).toBe('user-role');
        expect(result.items[0].breakdown.speaker).toBe(1);
    });

    it('10. boosts explicit preferences for recommendation questions', () => {
        const preference = make_node('preference', 'I also like hotels with rooftop pools', {
            claims: [{ kind: 'preference', statement: 'I also like hotels with rooftop pools', subject: 'user', predicate: 'prefers', object: 'hotels with rooftop pools', topic: 'preference:general' }],
        });
        const generic = make_node('generic', 'Hotels can have many amenities');
        const result = associative_recall({ text: 'Can you recommend a hotel?', now, vector: null }, { index: new InMemoryRecallIndex([generic, preference]) });
        expect(result.items[0].node.id).toBe('preference');
        expect(result.items[0].breakdown.preference).toBe(1);
    });
});
