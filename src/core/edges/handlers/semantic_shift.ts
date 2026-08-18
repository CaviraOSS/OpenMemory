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
 *  file  : src/core/edges/handlers/semantic_shift.ts
 *  usage : edge handler recording meaning drift over time
 */









import type { HydroEdge } from '../../types/hydro_edge.js';
import type { EdgeContext, EdgeHandler, HandlerOutcome } from '../edge_context.js';

export const semantic_shift_handler: EdgeHandler = {
    type: 'semantic_shift',
    run(edge: HydroEdge, ctx: EdgeContext): HandlerOutcome {
        const from = ctx.get_node(edge.from);
        const to = ctx.get_node(edge.to);
        const note = typeof edge.handler.params.note === 'string' ? edge.handler.params.note : 'meaning drift';

        ctx.record_semantic_shift(from.id, to.id, note);

        return {
            affected_node_ids: [from.id, to.id],
            notes: [`semantic shift ${from.id} -> ${to.id}: ${note}`],
        };
    },
};
