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
 *  file  : src/core/edges/handlers/contradicts.ts
 *  usage : implements the LongMemory contradicts component
 */


import type { HydroEdge } from '../../types/hydro_edge.js';
import { clamp01 } from '../../math/utility.js';
import type { EdgeContext, EdgeHandler, HandlerOutcome } from '../edge_context.js';

export const contradicts_handler: EdgeHandler = {
    type: 'contradicts',
    run(edge: HydroEdge, ctx: EdgeContext): HandlerOutcome {
        const a = ctx.get_node(edge.from);
        const b = ctx.get_node(edge.to);
        const pressure = clamp01(edge.confidence * edge.weight) || 0.5;

        const contradiction = ctx.add_contradiction(a.id, b.id, pressure);
        ctx.bump_pressure(a.id, pressure);
        ctx.bump_pressure(b.id, pressure);

        ctx.update_node_state(a.id, { status: 'contradicted' });
        ctx.update_node_state(b.id, { status: 'contradicted' });

        return {
            affected_node_ids: [a.id, b.id],
            notes: [`unresolved contradiction ${contradiction.id} (pressure ${pressure})`],
        };
    },
};
