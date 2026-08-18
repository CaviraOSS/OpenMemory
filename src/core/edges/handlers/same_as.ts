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
 *  file  : src/core/edges/handlers/same_as.ts
 *  usage : edge handler linking an alias to a canonical entity
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
