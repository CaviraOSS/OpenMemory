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
 *  file  : src/core/recall/mode_gates.ts
 *  usage : implements the LongMemory mode gates component
 */

import { is_recorded_at, is_valid_at } from '../temporal/bitemporal.js';
import type { HydroNode } from '../types/hydro_node.js';
import {
    default_gate_thresholds,
    type GateContext,
    type GateResult,
    type GateThresholds,
    type RecallLabel,
} from '../types/recall_mode.js';

function thresholds(ctx: GateContext): GateThresholds {
    return { ...default_gate_thresholds, ...(ctx.thresholds ?? {}) };
}

function is_superseded(node: HydroNode): boolean {
    return node.temporal.superseded_at !== null || node.state.status === 'superseded';
}

function is_contradicted(node: HydroNode): boolean {
    return node.state.status === 'contradicted';
}

function is_expired(node: HydroNode, now: number): boolean {
    if (node.temporal.valid_to !== null && now >= node.temporal.valid_to) return true;
    const max = node.contract.max_valid_duration;
    if (max !== null && now >= node.temporal.valid_from + max) return true;
    return false;
}

function has_source(node: HydroNode): boolean {
    return node.provenance.source_trace.length > 0 || node.grounding.source_ids.length > 0;
}

function grounding_of(node: HydroNode, ctx: GateContext): number {
    return ctx.grounding_score ?? node.grounding.grounding_score;
}

function status_label(node: HydroNode): RecallLabel {
    if (is_superseded(node)) return 'superseded';
    if (is_contradicted(node)) return 'contradicted';
    return 'active';
}

export function can_access_node(node: HydroNode, ctx: GateContext): { allowed: boolean; reason: string | null } {
    const permission = node.contract.source_permission;
    if (!permission || permission.scope === 'public') return { allowed: true, reason: null };
    const access = ctx.permission_context;
    if (!access) return { allowed: false, reason: `permission context required for ${permission.scope}` };
    if (permission.scope === 'private') return access.allow_private ? { allowed: true, reason: null } : { allowed: false, reason: 'private source permission denied' };
    if (permission.scope === 'user_only') {
        return access.user_id && permission.user_ids.includes(access.user_id)
            ? { allowed: true, reason: null }
            : { allowed: false, reason: 'user-only source permission denied' };
    }
    if (permission.scope === 'team') {
        return (access.team_ids ?? []).some((id) => permission.team_ids.includes(id))
            ? { allowed: true, reason: null }
            : { allowed: false, reason: 'team source permission denied' };
    }
    if (permission.scope === 'project') {
        return (access.project_ids ?? []).some((id) => permission.project_ids.includes(id))
            ? { allowed: true, reason: null }
            : { allowed: false, reason: 'project source permission denied' };
    }
    return permission.source_id && (access.source_ids ?? []).includes(permission.source_id)
        ? { allowed: true, reason: null }
        : { allowed: false, reason: 'source-restricted permission denied' };
}


export function can_use_in_strict_recall(node: HydroNode, ctx: GateContext): GateResult {
    const t = thresholds(ctx);
    const reasons: string[] = [];

    if (is_superseded(node)) reasons.push('superseded');
    if (is_contradicted(node)) reasons.push('contradicted');
    if (ctx.unresolved_contradiction) reasons.push('unresolved contradiction');
    if (node.state.confidence < t.min_confidence) reasons.push(`low confidence ${node.state.confidence}`);
    if (!node.contract.use_for_reasoning) reasons.push('contract forbids reasoning');

    const grounding = grounding_of(node, ctx);
    if (node.contract.requires_grounding && grounding < t.grounding_threshold) {
        reasons.push('ungrounded but grounding required');
    }

    const expired = is_expired(node, ctx.now);
    if (expired && node.contract.expires_if_unconfirmed && grounding < t.grounding_threshold) {
        reasons.push('expired and unconfirmed');
    } else if (expired) {
        reasons.push('expired (no longer valid)');
    }

    if (node.contract.source_required && !has_source(node)) reasons.push('source required but missing');
    const access = can_access_node(node, ctx);
    if (!access.allowed) reasons.push(access.reason as string);

    return { allowed: reasons.length === 0, mode: 'strict', label: status_label(node), reasons };
}

/** Historical recall: superseded/old memories that were valid at a past time. */
export function can_use_in_historical_recall(node: HydroNode, ctx: GateContext): GateResult {
    const reasons: string[] = [];
    let allowed = false;

    if (ctx.at !== undefined) {
        allowed = is_valid_at(node, ctx.at);
        if (!allowed) reasons.push(`not valid at ${ctx.at}`);
    } else if (ctx.as_of !== undefined) {
        allowed = is_recorded_at(node, ctx.as_of);
        if (!allowed) reasons.push(`not known as of ${ctx.as_of}`);
    } else {
        reasons.push('historical recall requires `at` or `asOf`');
    }
    const access = can_access_node(node, ctx);
    if (!access.allowed) {
        allowed = false;
        reasons.push(access.reason as string);
    }

    const label: RecallLabel = is_superseded(node) ? 'superseded' : 'historical';
    return { allowed, mode: 'historical', label, reasons };
}

/** Associative recall: permissive, but always labels what it admits. */
export function can_use_in_associative_recall(node: HydroNode, ctx: GateContext): GateResult {
    const t = thresholds(ctx);
    const reasons: string[] = [];

    if (!node.contract.use_for_associative_recall) reasons.push('contract forbids associative recall');
    if (node.contract.privacy_level === 'secret') reasons.push('secret privacy level');
    const access = can_access_node(node, ctx);
    if (!access.allowed) reasons.push(access.reason as string);

    let label: RecallLabel = 'active';
    if (node.facets.emotional !== null || node.contract.use_for_emotional_context) {
        label = 'emotional_residue';
    } else if (is_superseded(node)) {
        label = 'superseded';
    } else if (node.state.confidence < t.min_confidence) {
        label = 'weak_pattern';
    }

    return { allowed: reasons.length === 0, mode: 'associative', label, reasons };
}

/** World-grounded recall: requires grounding, freshness, provenance, reliability. */
export function can_use_in_world_grounded_recall(node: HydroNode, ctx: GateContext): GateResult {
    const t = thresholds(ctx);
    const reasons: string[] = [];

    const grounding = grounding_of(node, ctx);
    if (node.grounding.worlddb_ref === null || grounding < t.grounding_threshold) {
        reasons.push('not grounded to an external fact');
    }
    if ((ctx.freshness ?? 0) < t.min_freshness) reasons.push('grounding not fresh enough');
    if (!has_source(node)) reasons.push('provenance/source missing');
    if ((ctx.source_reliability ?? 0) < t.min_source_reliability) reasons.push('source reliability too low');
    const access = can_access_node(node, ctx);
    if (!access.allowed) reasons.push(access.reason as string);

    return { allowed: reasons.length === 0, mode: 'world_grounded', label: 'grounded', reasons };
}
