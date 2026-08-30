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
 *  file  : src/core/edges/handlers/same_as.ts
 *  usage : implements the LongMemory same as component
 */

import type { HydroEdge } from '../../types/hydro_edge.js';
import type { EdgeContext, EdgeHandler, HandlerOutcome } from '../edge_context.js';

export const same_as_handler: EdgeHandler = {
    type: 'same_as',
    run(edge: HydroEdge, ctx: EdgeContext): HandlerOutcome {
        const alias = ctx.get_node(edge.from);
        const canonical = ctx.get_node(edge.to);

        ctx.set_alias(alias.id, canonical.id);

        return {
            affected_node_ids: [alias.id],
            notes: [`alias ${alias.id} -> canonical ${ctx.resolve_entity(alias.id)}`],
        };
    },
};
