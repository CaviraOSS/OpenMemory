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
 *  file  : src/core/edges/handlers/supersedes.ts
 *  usage : edge handler that supersedes an old node with a new one
 */









import type { HydroEdge } from '../../types/hydro_edge.js';
import { clamp01 } from '../../math/utility.js';
import type { EdgeContext, EdgeHandler, HandlerOutcome } from '../edge_context.js';

const salience_transfer = 0.3;

export const supersedes_handler: EdgeHandler = {
    type: 'supersedes',
    run(edge: HydroEdge, ctx: EdgeContext): HandlerOutcome {
        const old_node = ctx.get_node(edge.to);
        const new_node = ctx.get_node(edge.from);
        const now = ctx.now;

        if (old_node.temporal.valid_to === null || old_node.temporal.valid_to > now) {
            ctx.update_node_temporal(old_node.id, { valid_to: now });
        }
        ctx.update_node_temporal(old_node.id, { superseded_at: now });
        ctx.update_node_state(old_node.id, { status: 'superseded' });

        const transferred = old_node.state.salience * salience_transfer;
        ctx.update_node_state(old_node.id, {
            salience: clamp01(old_node.state.salience - transferred),
        });
        ctx.update_node_state(new_node.id, {
            status: 'active',
            salience: clamp01(new_node.state.salience + transferred),
        });

        ctx.link_history(old_node.id, new_node.id);

        return {
            affected_node_ids: [old_node.id, new_node.id],
            notes: [`superseded ${old_node.id} with ${new_node.id} at ${now}`],
        };
    },
};
