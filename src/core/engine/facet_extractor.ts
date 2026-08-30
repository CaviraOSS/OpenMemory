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
 *  file  : src/core/engine/facet_extractor.ts
 *  usage : implements the LongMemory facet extractor component
 */

import { empty_facets, type Facets } from '../types/facets.js';
import type { ParsedPerception } from './perception_parser.js';

export function extract_facets(parsed: ParsedPerception): Facets {
    const facets = empty_facets();
    if (parsed.preferences.length > 0 || parsed.claims.some((claim) => claim.kind === 'fact')) {
        facets.semantic = { value: parsed.text, weight: parsed.preferences.length > 0 ? 1 : 0.8 };
    }
    if (parsed.actions.length > 0) facets.episodic = { value: parsed.actions.join('; '), weight: 0.8 };
    if (parsed.procedures.length > 0 || parsed.claims.some((claim) => claim.kind === 'procedure')) {
        facets.procedural = { value: parsed.procedures.join('; ') || parsed.text, weight: 0.9 };
    }
    if (parsed.emotions.length > 0) facets.emotional = { value: parsed.emotions.join(', '), weight: 0.9 };
    if (parsed.reflections.length > 0 || parsed.claims.some((claim) => claim.kind === 'reflection')) {
        facets.reflective = { value: parsed.reflections.join('; ') || parsed.text, weight: 0.8 };
    }
    if (parsed.event.facet_hint) facets[parsed.event.facet_hint] = { value: parsed.text, weight: 0.9 };
    if (Object.values(facets).every((facet) => facet === null)) {
        facets.episodic = { value: parsed.text, weight: 0.6 };
    }
    return facets;
}