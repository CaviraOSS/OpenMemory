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
 *  file  : src/core/types/node_state.ts
 *  usage : implements the LongMemory node state component
 */

export type NodeStatus =
    | 'active'
    | 'superseded'
    | 'contradicted'
    | 'expired'
    | 'draft';

export type NodeState = {
    status: NodeStatus;

    confidence: number;

    salience: number;

    activation: number;

    decay_rate: number;

    decay_updated_at?: number | null;

    last_reinforced_at?: number | null;

    reinforcement_count?: number;
};

export function default_node_state(): NodeState {
    return {
        status: 'active',
        confidence: 1,
        salience: 0.5,
        activation: 0.5,
        decay_rate: 0.05,
        decay_updated_at: null,
        last_reinforced_at: null,
        reinforcement_count: 0,
    };
}
