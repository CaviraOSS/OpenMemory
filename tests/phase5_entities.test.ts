import { describe, expect, it } from 'vitest';
import {
    EntityResolver,
    prevent_unsafe_merge,
    resolve_entity,
    type Entity,
    type EntityMention,
} from '../src/core/index.js';

const now = 1_700_000_000_000;

function resolver(): EntityResolver {
    return new EntityResolver({ now: now });
}

function alice(r: EntityResolver): Entity {
    return r.add_entity({
        name: 'Alice Chen',
        type: 'person',
        vector: [1, 0, 0, 0],
        context: ['memory', 'research', 'conference'],
        world_id: 'world:work',
        observed_at: now,
        aliases: ['A. Chen'],
        metadata: { domain: 'research' },
    });
}

describe('phase 5 entity resolver', () => {
    it('1. alias resolves correctly', () => {
        const r = resolver();
        const canonical = alice(r);
        const result = resolve_entity({ name: 'A. Chen', observed_at: now }, r);
        expect(result.action).toBe('resolved');
        expect(result.entity.id).toBe(canonical.id);
    });

    it('2. same name, different context does not merge', () => {
        const r = resolver();
        r.add_entity({
            name: 'John',
            type: 'person',
            vector: [1, 0, 0],
            context: ['school', 'class'],
            metadata: { domain: 'school' },
            observed_at: now,
        });
        const result = resolve_entity(
            {
                name: 'John',
                type: 'person',
                vector: [1, 0, 0],
                context: ['hosting', 'support', 'server'],
                metadata: { domain: 'hosting' },
                observed_at: now,
            },
            r,
        );
        expect(result.action).not.toBe('resolved');
        expect(r.entity_list()).toHaveLength(2);
    });

    it('3. similar entities create a candidate, not a forced merge', () => {
        const r = resolver();
        alice(r);
        const result = resolve_entity(
            {
                name: 'Alicia Chen',
                type: 'person',
                vector: [0.8, 0.2, 0, 0],
                context: ['memory', 'research'],
                metadata: { domain: 'research' },
                observed_at: now,
            },
            r,
        );
        expect(result.action).toBe('candidate');
        expect(result.candidate).toBeDefined();
        expect(result.candidate?.resolved).toBe(false);
    });

    it('4. entity drift creates a semantic_shift edge', () => {
        const r = resolver();
        const project = r.add_entity({
            name: 'Project Alpha',
            type: 'project',
            vector: [1, 0, 0, 0],
            context: ['hobby', 'weekend', 'prototype'],
            observed_at: now,
        });
        const { drift, edge } = r.record_semantic_drift(project, {
            context: ['production', 'infrastructure', 'critical'],
            vector: [0, 1, 0, 0],
            at: now + 1000,
        });
        expect(drift.drifted).toBe(true);
        expect(edge?.type).toBe('semantic_shift');
        expect(project.drift_history).toHaveLength(1);
        
        expect(project.canonical_name).toBe('Project Alpha');
    });

    it('5. manual same_as merge updates canonical mapping', () => {
        const r = resolver();
        const canonical = alice(r);
        const candidate = r.add_entity({
            name: 'Alicia Chen',
            type: 'person',
            vector: [0.8, 0.2, 0, 0],
            context: ['memory', 'research'],
            observed_at: now,
        });
        r.create_same_as_edge(candidate, canonical);
        const result = resolve_entity({ name: 'Alicia Chen', observed_at: now }, r);
        expect(result.action).toBe('resolved');
        expect(result.entity.id).toBe(canonical.id);
    });

    it('6. wrong merge prevention test passes', () => {
        const r = resolver();
        const john_school = r.add_entity({
            name: 'John',
            type: 'person',
            metadata: { domain: 'school' },
            observed_at: now,
        });
        const john_hosting = r.add_entity({
            name: 'John',
            type: 'person',
            metadata: { domain: 'hosting' },
            observed_at: now,
        });
        expect(prevent_unsafe_merge(john_school, john_hosting)).toBe(true);
    });

    it('7. resolver is deterministic with fixed inputs', () => {
        const mention: EntityMention = {
            name: 'Alicia Chen',
            type: 'person',
            vector: [0.8, 0.2, 0, 0],
            context: ['memory', 'research'],
            metadata: { domain: 'research' },
            observed_at: now,
        };
        const r1 = resolver();
        alice(r1);
        const r2 = resolver();
        alice(r2);
        const a = resolve_entity(mention, r1);
        const b = resolve_entity(mention, r2);
        expect(a.action).toBe(b.action);
        expect(a.score).toBe(b.score);
        expect(a.entity.id).toBe(b.entity.id);
    });

    it('new entity is created when nothing is close', () => {
        const r = resolver();
        alice(r);
        const result = resolve_entity(
            { name: 'Berlin', type: 'place', vector: [0, 0, 1, 0], observed_at: now },
            r,
        );
        expect(result.action).toBe('created');
        expect(r.entity_list()).toHaveLength(2);
    });
});
