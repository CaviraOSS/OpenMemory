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
 *  file  : src/core/recall/evidence.ts
 *  usage : dated, status-labelled evidence rendering for answer grounding
 */

import { render_claim } from '../engine/claim_extractor.js';
import type { HydroNode, NodeClaim } from '../types/hydro_node.js';
import { strict_recall_tokens } from './recall_text.js';

export type memory_status = 'current' | 'superseded' | 'contradicted';

export type memory_evidence_options = {
    query_terms?: readonly string[];
    max_claims?: number;
    include_time?: boolean;
    include_status?: boolean;
    include_speaker?: boolean;
};

export type memory_evidence = {
    id: string;
    text: string;
    observed_at: number;
    status: memory_status;
    speaker: string | null;
};

export function memory_status_of(node: HydroNode): memory_status {
    if (node.temporal.superseded_at !== null || node.state.status === 'superseded') return 'superseded';
    if (node.state.status === 'contradicted') return 'contradicted';
    return 'current';
}

export function memory_speaker_of(node: HydroNode): string | null {
    const speaker = node.metadata.speaker ?? node.metadata.role;
    return typeof speaker === 'string' && speaker.trim() ? speaker.trim() : null;
}

function iso_date(at: number): string {
    return Number.isFinite(at) ? new Date(at).toISOString().slice(0, 10) : 'undated';
}

const narrative_kinds = new Set<NodeClaim['kind']>(['action', 'procedure', 'reflection']);

function present_claim(claim: NodeClaim): string {
    return narrative_kinds.has(claim.kind) && claim.statement.trim() ? claim.statement.trim() : render_claim(claim);
}

function claim_body(node: HydroNode, query_terms: readonly string[], max_claims: number): string {
    const claims: readonly NodeClaim[] = node.content.claims ?? [];
    if (claims.length === 0) return '';
    const terms = new Set(query_terms.map((term) => term.toLowerCase()));
    const unique = [...new Set(claims.map((claim) => present_claim(claim)))];
    const scored = unique.map((text, order) => {
        let overlap = 0;
        for (const token of new Set(strict_recall_tokens(text))) if (terms.has(token)) overlap++;
        return { text, overlap, order };
    });
    scored.sort((left, right) => right.overlap - left.overlap || left.order - right.order);
    const relevant = scored.filter((claim) => claim.overlap > 0);
    return (relevant.length ? relevant : scored).slice(0, max_claims).map((claim) => claim.text).join('; ');
}

export function memory_evidence_text(node: HydroNode, options: memory_evidence_options = {}): string {
    const body = claim_body(node, options.query_terms ?? [], options.max_claims ?? 8)
        || node.content.summary
        || node.content.canonical
        || node.content.raw;
    const status = memory_status_of(node);
    const speaker = options.include_speaker === false ? null : memory_speaker_of(node);
    const labels: string[] = [];
    if (options.include_time !== false) labels.push(iso_date(node.temporal.observed_at));
    if (speaker) labels.push(speaker);
    if (options.include_status !== false && status !== 'current') labels.push(status);
    return labels.length ? `[${labels.join(' ')}] ${body}` : body;
}

export function memory_evidence_of(node: HydroNode, options: memory_evidence_options = {}): memory_evidence {
    return {
        id: node.id,
        text: memory_evidence_text(node, options),
        observed_at: node.temporal.observed_at,
        status: memory_status_of(node),
        speaker: memory_speaker_of(node),
    };
}
