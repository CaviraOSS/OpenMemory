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
 *  file  : src/core/invariants.ts
 *  usage : implements the LongMemory invariants component
 */


export const hydrograph_invariants = [
    'durable nodes are immutable',
    'every durable node is content-addressed',
    'every durable fact is bitemporal',
    'edges are executable',
    'subjective memory and external world truth are separate',
    'worlds are recursive containers, not flat sectors',
    'facets are cognitive attributes, not storage buckets',
    'strict recall cannot use superseded facts',
    'strict recall cannot use unresolved contradictions',
    'world-grounded recall requires grounding',
    'associative recall may use superseded/emotional residue but must label it',
    'compression cannot override truth',
    'api server and cli must use the same createMemory engine',
    'benchmarks define correctness',
] as const;

export function assert_hydrograph_invariants(): readonly string[] {
    return hydrograph_invariants;
}
