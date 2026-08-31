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
 *  file  : src/core/edges/edge_registry.ts
 *  usage : implements the LongMemory edge registry component
 */


import type { HydroEdge } from '../types/hydro_edge.js';
import type { EdgeContext, EdgeHandler, HandlerOutcome } from './edge_context.js';
import { contains_handler } from './handlers/contains.js';
import { contradicts_handler } from './handlers/contradicts.js';
import { derived_from_handler } from './handlers/derived_from.js';
import { grounds_handler } from './handlers/grounds.js';
import { same_as_handler } from './handlers/same_as.js';
import { semantic_shift_handler } from './handlers/semantic_shift.js';
import { supersedes_handler } from './handlers/supersedes.js';
import { supports_handler } from './handlers/supports.js';


export const refers_to_handler: EdgeHandler = {
    type: 'refers_to',
    run(edge: HydroEdge, ctx: EdgeContext): HandlerOutcome {
        const from = ctx.get_node(edge.from);
        const to = ctx.get_node(edge.to);
        ctx.add_reference(from.id, to.id);
        return { affected_node_ids: [], notes: [`${from.id} refers_to ${to.id}`] };
    },
};

export class EdgeRegistry {
    private handlers = new Map<string, EdgeHandler>();

    register(handler: EdgeHandler): this {
        this.handlers.set(handler.type, handler);
        return this;
    }

    get(type: string): EdgeHandler | undefined {
        return this.handlers.get(type);
    }

    has(type: string): boolean {
        return this.handlers.has(type);
    }

    types(): string[] {
        return [...this.handlers.keys()];
    }
}

export function default_edge_registry(): EdgeRegistry {
    return new EdgeRegistry()
        .register(contains_handler)
        .register(refers_to_handler)
        .register(same_as_handler)
        .register(supports_handler)
        .register(contradicts_handler)
        .register(supersedes_handler)
        .register(derived_from_handler)
        .register(grounds_handler)
        .register(semantic_shift_handler);
}
