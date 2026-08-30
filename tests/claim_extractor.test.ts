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
 *  file  : tests/claim_extractor.test.ts
 *  usage : verifies LongMemory claim extractor.test behavior
 */

import { describe, expect, it } from 'vitest';
import { extract_claims } from '../src/core/engine/claim_extractor.js';
import { parse_perception } from '../src/core/engine/perception_parser.js';

describe('structured claim extraction', () => {
    it('extracts markdown table cells as row and column facts', () => {
        const claims = extract_claims(`Shift rotation

| Day | 8 am - 4 pm | 4 pm - 12 am |
| --- | --- | --- |
| Sunday | Admon | Ehab |
| Monday | Sara | Admon |`);
        expect(claims).toEqual(expect.arrayContaining([
            expect.objectContaining({ subject: 'sunday', predicate: 'table:8 am - 4 pm', object: 'admon' }),
            expect.objectContaining({ subject: 'monday', predicate: 'table:4 pm - 12 am', object: 'admon' }),
        ]));
    });

    it('attributes fallback claims to the source speaker', () => {
        const claims = extract_claims('assistant: Try setting a reminder. Then check the receipt.');
        expect(claims.map((claim) => claim.subject)).toEqual(['assistant', 'assistant']);
        expect(claims[0].object).not.toContain('assistant:');
    });

    it('attributes parsed claims and entities to an explicit speaker without changing text', () => {
        const parsed = parse_perception({ user_id: 'conversation', speaker: 'Caroline', text: 'I started counseling.' }, 1);
        expect(parsed.text).toBe('I started counseling.');
        expect(parsed.claims[0].subject).toBe('caroline');
        expect(parsed.entities.some((entity) => entity.name === 'Caroline')).toBe(true);
    });

    it('extracts named movement as a comparable location update', () => {
        expect(extract_claims('My friend Rachel actually just moved back to the suburbs again.')).toEqual([
            expect.objectContaining({ kind: 'fact', subject: 'rachel', predicate: 'located_in', object: 'suburbs again' }),
        ]);
    });

    it('recognizes preferences with conversational adverbs', () => {
        expect(extract_claims('Besides great views, I also like hotels with a rooftop pool.')).toEqual([
            expect.objectContaining({ kind: 'preference', predicate: 'prefers', object: 'hotels with a rooftop pool' }),
        ]);
    });
});