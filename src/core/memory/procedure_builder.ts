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
 *  file  : src/core/memory/procedure_builder.ts
 *  usage : implements the LongMemory procedure builder component
 */


import type { Contract } from '../types/contract.js';
import { empty_facets } from '../types/facets.js';
import type { HydroNode } from '../types/hydro_node.js';
import { default_node_state } from '../types/node_state.js';
import type { Provenance } from '../types/provenance.js';
import { create_hydro_node } from './durable_graph.js';
import type { ConsolidationPattern } from './pattern_detector.js';

export type ProcedureBuildContext = {
    now: number;
    contract: Contract;
    provenance: Provenance;
    vector: number[] | null;
};

function newest_source(sources: readonly HydroNode[]): HydroNode {
    return [...sources].sort((left, right) => right.temporal.observed_at - left.temporal.observed_at)[0];
}

export function build_procedure_memory(
    pattern: ConsolidationPattern,
    ctx: ProcedureBuildContext,
): HydroNode {
    if (pattern.kind !== 'procedural') throw new Error('buildProcedureMemory requires a procedural pattern');
    const newest = newest_source(pattern.sources);
    const statement = `Procedure learned from repeated outcomes: ${pattern.statement}`;
    return create_hydro_node({
        content: { raw: statement, canonical: statement.toLowerCase(), summary: statement },
        facets: { ...empty_facets(), procedural: { value: statement, weight: 1 } },
        world: newest.world,
        temporal: {
            valid_from: ctx.now,
            valid_to: null,
            observed_at: newest.temporal.observed_at,
            recorded_at: ctx.now,
            superseded_at: null,
        },
        contract: ctx.contract,
        grounding: { worlddb_ref: null, source_ids: [], grounding_score: 0 },
        state: {
            ...default_node_state(),
            confidence: Math.min(1, pattern.signals.confidence + 0.1),
            salience: Math.min(1, pattern.signals.salience + 0.1),
        },
        vectors: { semantic: ctx.vector, type_vector: null, world_vector: newest.vectors.world_vector },
        provenance: ctx.provenance,
    });
}