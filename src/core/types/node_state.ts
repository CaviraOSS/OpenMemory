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
 *  file  : src/core/types/node_state.ts
 *  usage : mutable runtime state envelope around a durable node
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
