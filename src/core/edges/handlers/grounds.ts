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
 *  file  : src/core/edges/handlers/grounds.ts
 *  usage : implements the LongMemory grounds component
 */

import type { HydroEdge } from '../../types/hydro_edge.js';
import { clamp01 } from '../../math/utility.js';
import type { EdgeContext, EdgeHandler, HandlerOutcome } from '../edge_context.js';

export const grounds_handler: EdgeHandler = {
    type: 'grounds',
    run(edge: HydroEdge, ctx: EdgeContext): HandlerOutcome {
        const endo = ctx.get_node(edge.from);
        const world = ctx.get_node(edge.to);

        const evidence = clamp01(edge.confidence * edge.weight);
        const prior = endo.grounding.grounding_score;
        const updated = clamp01(prior + (1 - prior) * evidence);
        const sourceids = endo.grounding.source_ids.includes(world.id)
            ? endo.grounding.source_ids
            : [...endo.grounding.source_ids, world.id];

        ctx.update_node_grounding(endo.id, {
            worlddb_ref: endo.grounding.worlddb_ref ?? world.id,
            grounding_score: updated,
            source_ids: sourceids,
        });

        return {
            affected_node_ids: [endo.id],
            notes: [`grounding ${prior.toFixed(3)} -> ${updated.toFixed(3)} via ${world.id}`],
        };
    },
};
