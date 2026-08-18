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
 *  file  : src/core/edges/handlers/supports.ts
 *  usage : edge handler raising a target node's confidence
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
