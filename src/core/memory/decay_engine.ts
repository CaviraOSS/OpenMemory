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
 *  file  : src/core/memory/decay_engine.ts
 *  usage : implements the LongMemory decay engine component
 */

import { decay_rate, retention } from '../math/decay.js';
import { clamp01 } from '../math/utility.js';
import type { HydroNode } from '../types/hydro_node.js';

const day_ms = 86_400_000;

export type decay_tier = 'hot' | 'warm' | 'cold';

export type decay_policy = {
    hot_lambda: number;
    warm_lambda: number;
    cold_lambda: number;
    hot_days: number;
    warm_days: number;
    activation_floor: number;
    reinforcement_gain: number;
};

export const default_decay_policy: Readonly<decay_policy> = Object.freeze({
    hot_lambda: 0.005,
    warm_lambda: 0.02,
    cold_lambda: 0.05,
    hot_days: 7,
    warm_days: 30,
    activation_floor: 0.05,
    reinforcement_gain: 0.2,
});

export type decay_projection = {
    activation: number;
    decay_rate: number;
    elapsed_days: number;
    retention: number;
    tier: decay_tier;
};

const policy = (overrides: Partial<decay_policy> = {}): decay_policy => {
    const value = { ...default_decay_policy, ...overrides };
    if (![value.hot_lambda, value.warm_lambda, value.cold_lambda].every((item) => Number.isFinite(item) && item >= 0)) {
        throw new Error('decay lambdas must be finite non-negative numbers');
    }
    if (!Number.isFinite(value.hot_days) || !Number.isFinite(value.warm_days) || value.hot_days < 0 || value.warm_days < value.hot_days) {
        throw new Error('decay tier windows must be finite and ordered');
    }
    if (!Number.isFinite(value.activation_floor) || value.activation_floor < 0 || value.activation_floor > 1) {
        throw new Error('activation_floor must be between 0 and 1');
    }
    if (!Number.isFinite(value.reinforcement_gain) || value.reinforcement_gain < 0 || value.reinforcement_gain > 1) {
        throw new Error('reinforcement_gain must be between 0 and 1');
    }
    return value;
};

const reinforcement_count = (node: HydroNode): number => Math.max(0, node.state.reinforcement_count ?? 0);

const reference_at = (node: HydroNode): number => node.state.last_reinforced_at ?? node.temporal.observed_at;

const tier_at = (node: HydroNode, at: number, cfg: decay_policy): decay_tier => {
    const age_days = Math.max(0, at - reference_at(node)) / day_ms;
    const strong = reinforcement_count(node) >= 3 || node.state.salience >= 0.75;
    if (strong && age_days < cfg.hot_days) return 'hot';
    if (age_days < cfg.warm_days) return 'warm';
    return 'cold';
};

const node_retention = (node: HydroNode): number => retention({
    importance: clamp01(node.state.salience),
    surprise: 0,
    grounding: clamp01(node.grounding.grounding_score),
    emotional_intensity: clamp01(node.facets.emotional?.weight ?? 0),
    utility: clamp01(node.facets.procedural?.weight ?? 0),
    confirmation: clamp01(node.grounding.source_ids.length / 3),
    noise: clamp01(1 - node.state.confidence),
});

const rate_for = (node: HydroNode, tier: decay_tier, keep: number, cfg: decay_policy): number => decay_rate({
    base_lambda: tier === 'hot' ? cfg.hot_lambda : tier === 'warm' ? cfg.warm_lambda : cfg.cold_lambda,
    noise: clamp01(1 - node.state.confidence),
    conflict: node.state.status === 'contradicted' ? 1 : 0,
    retention: keep,
    reinforcement: Math.min(2, Math.log1p(reinforcement_count(node)) / 2),
});

export function project_node_decay(node: HydroNode, at: number, overrides: Partial<decay_policy> = {}): decay_projection {
    if (!Number.isFinite(at)) throw new Error('decay time must be finite');
    const cfg = policy(overrides);
    const anchor = node.state.decay_updated_at ?? node.temporal.observed_at;
    const end = Math.max(anchor, at);
    const elapsed_days = (end - anchor) / day_ms;
    const keep = node_retention(node);
    const reference = reference_at(node);
    const boundaries = [anchor, end, reference + cfg.hot_days * day_ms, reference + cfg.warm_days * day_ms]
        .filter((value) => value > anchor && value < end)
        .sort((left, right) => left - right);
    const points = [anchor, ...boundaries, end];
    let exponent = 0;
    for (let index = 0; index < points.length - 1; index++) {
        const start = points[index];
        const stop = points[index + 1];
        const tier = tier_at(node, start + (stop - start) / 2, cfg);
        exponent += rate_for(node, tier, keep, cfg) * ((stop - start) / day_ms);
    }
    const floor = cfg.activation_floor;
    const initial = Math.max(floor, clamp01(node.state.activation));
    const activation = floor + (initial - floor) * Math.exp(-exponent);
    const tier = tier_at(node, end, cfg);
    return {
        activation: clamp01(activation),
        decay_rate: rate_for(node, tier, keep, cfg),
        elapsed_days,
        retention: keep,
        tier,
    };
}

export function decay_node(node: HydroNode, at: number, overrides: Partial<decay_policy> = {}): HydroNode {
    const projected = project_node_decay(node, at, overrides);
    return {
        ...node,
        state: {
            ...node.state,
            activation: projected.activation,
            decay_rate: projected.decay_rate,
            decay_updated_at: Math.max(node.state.decay_updated_at ?? node.temporal.observed_at, at),
        },
    };
}

export function reinforce_node(node: HydroNode, at: number, amount?: number, overrides: Partial<decay_policy> = {}): HydroNode {
    const cfg = policy(overrides);
    const gain = amount ?? cfg.reinforcement_gain;
    if (!Number.isFinite(at)) throw new Error('reinforcement time must be finite');
    if (!Number.isFinite(gain) || gain < 0 || gain > 1) throw new Error('reinforcement amount must be between 0 and 1');
    const effective_at = Math.max(node.state.decay_updated_at ?? node.temporal.observed_at, at);
    const projected = project_node_decay(node, effective_at, cfg);
    const activation = projected.activation + gain * (1 - projected.activation);
    const reinforced = {
        ...node,
        state: {
            ...node.state,
            activation: clamp01(activation),
            decay_updated_at: effective_at,
            last_reinforced_at: effective_at,
            reinforcement_count: reinforcement_count(node) + 1,
        },
    };
    return {
        ...reinforced,
        state: { ...reinforced.state, decay_rate: project_node_decay(reinforced, effective_at, cfg).decay_rate },
    };
}