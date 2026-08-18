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
 *  file  : src/core/edges/handlers/contains.ts
 *  usage : edge handler adding a child into a parent world
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
