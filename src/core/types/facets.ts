/*
 *   _____                 ___  ___
 *  |  _  |                |  \/  |
 *  | | | |_ __   ___ _ __ | .  . | ___ _ __ ___   ___  _ __ _   _
 *  | | | | '_ \ / _ \ '_ \| |\/| |/ _ \ '_ ` _ \ / _ \| '__| | | |
 *  \ \_/ / |_) |  __/ | | | |  | |  __/ | | | | | (_) | |  | |_| |
 *   \___/| .__/ \___|_| |_\_|  |_/\___|_| |_| |_|\___/|_|   \__, |
 *        | |                                                 __/ |
 *        |_|                                                |___/
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : src/core/types/facets.ts
 *  usage : the five cognitive facets of a hydronode
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
