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
 *  file  : src/core/edges/handlers/derived_from.ts
 *  usage : implements the LongMemory derived from component
 */

import type { HydroEdge } from '../../types/hydro_edge.js';
import type { EdgeContext, EdgeHandler, HandlerOutcome } from '../edge_context.js';

export const derived_from_handler: EdgeHandler = {
    type: 'derived_from',
    run(edge: HydroEdge, ctx: EdgeContext): HandlerOutcome {
        const derived = ctx.get_node(edge.from);
        const source = ctx.get_node(edge.to);

        ctx.add_derivation(derived.id, source.id);
        ctx.append_provenance_source(derived.id, {
            source_id: source.id,
            ref: 'derived_from',
            at: ctx.now,
        });

        return {
            affected_node_ids: [derived.id],
            notes: [`derived ${derived.id} from ${source.id}`],
        };
    },
};
