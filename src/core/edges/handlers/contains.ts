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
 *  file  : src/core/edges/handlers/contains.ts
 *  usage : implements the LongMemory contains component
 */


import type { HydroEdge } from '../../types/hydro_edge.js';
import type { EdgeContext, EdgeHandler, HandlerOutcome } from '../edge_context.js';

export const contains_handler: EdgeHandler = {
    type: 'contains',
    run(edge: HydroEdge, ctx: EdgeContext): HandlerOutcome {
        const parent_id = edge.from;
        const child = ctx.get_node(edge.to);

        ctx.add_containment(parent_id, child.id);
        const root = ctx.world_merkle_root(parent_id);

        return {
            affected_node_ids: [child.id],
            notes: [`parent ${parent_id} now contains ${child.id}; world root ${root}`],
        };
    },
};
