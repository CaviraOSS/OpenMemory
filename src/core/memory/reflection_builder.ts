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
 *  file  : src/core/memory/reflection_builder.ts
 *  usage : build reflective summaries from contradiction clusters
 */

import type { Contract } from '../types/contract.js';
import { empty_facets } from '../types/facets.js';
import type { HydroNode } from '../types/hydro_node.js';
import { default_node_state } from '../types/node_state.js';
import type { Provenance } from '../types/provenance.js';
import { create_hydro_node } from './durable_graph.js';
import type { ConsolidationPattern } from './pattern_detector.js';

export type ReflectionBuildContext = {
    now: number;
    contract: Contract;
    provenance: Provenance;
    vector: number[] | null;
};

export function build_reflection_memory(
    pattern: ConsolidationPattern,
    ctx: ReflectionBuildContext,
): HydroNode {
    if (pattern.kind !== 'reflection') throw new Error('buildReflectionMemory requires a reflection pattern');
    const newest = [...pattern.sources].sort(
        (left, right) => right.temporal.observed_at - left.temporal.observed_at,
    )[0];
    const claims = pattern.sources.map((node) => `"${node.content.summary}"`).join(' conflicts with ');
    const statement = `Reflection: ${claims}. Preserve both as historical context; do not treat either as settled truth.`;
    return create_hydro_node({
        content: { raw: statement, canonical: statement.toLowerCase(), summary: statement },
        facets: { ...empty_facets(), reflective: { value: statement, weight: 1 } },
        world: newest.world,
        temporal: {
            valid_from: ctx.now,
            valid_to: null,
            observed_at: newest.temporal.observed_at,
            recorded_at: ctx.now,
            superseded_at: null,
        },
        contract: { ...ctx.contract, use_for_reasoning: false, use_for_prediction: false },
        grounding: { worlddb_ref: null, source_ids: [], grounding_score: 0 },
        state: {
            ...default_node_state(),
            confidence: Math.min(1, pattern.signals.confidence),
            salience: Math.min(1, pattern.signals.salience + 0.2),
        },
        vectors: { semantic: ctx.vector, type_vector: null, world_vector: newest.vectors.world_vector },
        provenance: ctx.provenance,
    });
}