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
 *  file  : src/core/edges/handlers/supports.ts
 *  usage : implements the LongMemory supports component
 */


import type { HydroEdge } from '../../types/hydro_edge.js';
import { clamp01 } from '../../math/utility.js';
import type { EdgeContext, EdgeHandler, HandlerOutcome } from '../edge_context.js';

export const supports_handler: EdgeHandler = {
    type: 'supports',
    run(edge: HydroEdge, ctx: EdgeContext): HandlerOutcome {
        const source = ctx.get_node(edge.from);
        const target = ctx.get_node(edge.to);

        const evidence = clamp01(edge.confidence * edge.weight);
        const prior = target.state.confidence;
        
        const updated = clamp01(prior + (1 - prior) * evidence);

        ctx.update_node_state(target.id, { confidence: updated });
        ctx.add_support(target.id, source.id);

        return {
            affected_node_ids: [target.id],
            notes: [`confidence ${prior.toFixed(3)} -> ${updated.toFixed(3)} from ${source.id}`],
        };
    },
};
