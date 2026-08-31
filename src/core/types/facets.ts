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
 *  file  : src/core/types/facets.ts
 *  usage : implements the LongMemory facets component
 */


export type FacetName =
    | 'episodic'
    | 'semantic'
    | 'procedural'
    | 'emotional'
    | 'reflective';

export const facet_names: readonly FacetName[] = [
    'episodic',
    'semantic',
    'procedural',
    'emotional',
    'reflective',
] as const;

export type Facet = {
    
    value: string;
    
    weight: number;
};

export type Facets = {
    episodic: Facet | null;
    semantic: Facet | null;
    procedural: Facet | null;
    emotional: Facet | null;
    reflective: Facet | null;
};

export function empty_facets(): Facets {
    return {
        episodic: null,
        semantic: null,
        procedural: null,
        emotional: null,
        reflective: null,
    };
}
