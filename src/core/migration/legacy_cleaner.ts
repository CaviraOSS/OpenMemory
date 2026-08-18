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
 *  file  : src/core/migration/legacy_cleaner.ts
 *  usage : conservatively clean and deduplicate legacy memories
 */

import type { GroundingSource, GroundingSourceKind } from '../grounding/exocortex.js';
import type { FacetName } from '../types/facets.js';
import type { legacy_read_issue, legacy_read_result } from './legacy_reader.js';

export type clean_legacy_record = {
    source_id: string;
    user_id: string;
    text: string;
    facet: FacetName;
    world: string;
    tags: string[];
    at: number;
    observed_at: number;
    valid_from: number;
    valid_to: number | null;
    source: GroundingSource | null;
    metadata: Record<string, unknown>;
};

export type clean_legacy_relation = {
    source_id: string;
    from: string;
    to: string;
    type: string;
    weight: number;
    at: number;
};

export type legacy_duplicate = { duplicate_id: string; canonical_id: string; reason: string };

export type clean_legacy_result = {
    records: clean_legacy_record[];
    relations: clean_legacy_relation[];
    duplicates: legacy_duplicate[];
    canonical_ids: Map<string, string>;
    skipped: legacy_read_issue[];
    errors: string[];
};

const record = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';

function json_record(value: unknown): Record<string, unknown> {
    if (record(value)) return value as Record<string, unknown>;
    if (typeof value !== 'string' || !value.trim()) return {};
    try { return record(JSON.parse(value) as unknown) ?? {}; } catch { return {}; }
}

function strings(value: unknown): string[] {
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean);
    if (typeof value !== 'string' || !value.trim()) return [];
    try { return strings(JSON.parse(value) as unknown); } catch { return value.split(',').map((item) => item.trim()).filter(Boolean); }
}

function timestamp(value: unknown, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value < 10_000_000_000 ? value * 1_000 : value;
    if (typeof value === 'string' && value.trim()) {
        const numeric = Number(value);
        if (Number.isFinite(numeric)) return numeric < 10_000_000_000 ? numeric * 1_000 : numeric;
        const parsed = Date.parse(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return fallback;
}

function bool(value: unknown): boolean | null {
    if (typeof value === 'boolean') return value;
    if (value === 1 || value === '1' || value === 'true') return true;
    if (value === 0 || value === '0' || value === 'false') return false;
    return null;
}

function facet_for(sector: string, content: string): FacetName {
    if (['semantic', 'fact', 'facts', 'preference', 'preferences', 'knowledge'].includes(sector)) return 'semantic';
    if (['procedural', 'procedure', 'workflow'].includes(sector)) return 'procedural';
    if (['emotional', 'emotion'].includes(sector)) return 'emotional';
    if (['reflective', 'reflection'].includes(sector)) return 'reflective';
    if (/\b(prefer|preference|favorite|favourite|like|love|dislike|hate)\b/i.test(content)) return 'semantic';
    return 'episodic';
}

function source_for(row: Record<string, unknown>, meta: Record<string, unknown>): GroundingSource | null {
    const nested = record(row.source) ?? record(meta.source) ?? {};
    const id = text(row.source_id) || text(nested.id) || text(meta.source_id);
    if (!id) return null;
    const allowed: GroundingSourceKind[] = ['tool', 'api', 'document', 'database', 'sensor', 'worlddb', 'manual'];
    const kind_value = text(row.source_kind) || text(nested.kind) || text(meta.source_kind);
    const kind = allowed.includes(kind_value as GroundingSourceKind) ? kind_value as GroundingSourceKind : 'document';
    const raw_reliability = Number(row.source_reliability ?? nested.reliability ?? meta.source_reliability ?? 0.7);
    return { id, kind, reliability: Number.isFinite(raw_reliability) ? Math.max(0, Math.min(1, raw_reliability)) : 0.7 };
}

function clean_one(value: unknown, index: number): clean_legacy_record | legacy_read_issue {
    const row = record(value);
    const fallback_id = `record:${index + 1}`;
    if (!row) return { record_id: fallback_id, reason: 'record_not_object' };
    const source_id = text(row.id) || text(row.memory_id) || text(row.uuid) || fallback_id;
    const meta = { ...json_record(row.meta), ...json_record(row.metadata) };
    const nested_content = record(row.content);
    const content = text(row.text) || text(row.segment) || text(nested_content?.raw) || text(nested_content?.text) || text(row.content);
    if (!content) return { record_id: source_id, reason: 'missing_content' };
    if (content.length > 1_048_576) return { record_id: source_id, reason: 'content_too_large' };
    if (!/[\p{L}\p{N}]/u.test(content)) return { record_id: source_id, reason: 'unknown_garbage' };
    const user_id = text(row.user_id) || text(row.user) || text(meta.user_id) || 'legacy';
    const sector = (text(row.primary_sector) || text(row.sector) || text(meta.sector) || 'episodic').toLowerCase();
    const created_at = timestamp(row.created_at ?? row.timestamp ?? row.time, index + 1);
    const observed_at = timestamp(row.last_seen_at ?? row.observed_at, created_at);
    const updated_at = timestamp(row.updated_at, observed_at);
    const valid_from = timestamp(row.valid_from, observed_at);
    const explicit_valid_to = row.valid_to ?? row.expired_at ?? row.deleted_at;
    let valid_to = explicit_valid_to == null ? null : timestamp(explicit_valid_to, updated_at);
    const status = (text(row.status) || text(meta.status)).toLowerCase();
    const current = bool(row.current ?? row.active ?? meta.current);
    if (valid_to === null && (current === false || ['stale', 'superseded', 'archived', 'deleted', 'expired'].includes(status))) {
        valid_to = Math.max(valid_from + 1, updated_at);
    }
    const source = source_for(row, meta);
    const external = source !== null && (bool(row.external ?? meta.external) === true || ['external', 'exocortex'].includes(sector));
    return {
        source_id,
        user_id,
        text: content.replace(/\s+/g, ' ').trim(),
        facet: facet_for(sector, content),
        world: text(row.world) || text(row.project_id) || `legacy:${external ? 'external' : sector}`,
        tags: [...new Set([...strings(row.tags), ...strings(meta.tags), `legacy-sector:${sector}`])],
        at: updated_at,
        observed_at,
        valid_from,
        valid_to,
        source: external ? source : null,
        metadata: { ...meta, legacy_id: source_id, legacy_sector: sector },
    };
}

function clean_relation(value: unknown, index: number): clean_legacy_relation | null {
    const row = record(value);
    if (!row) return null;
    const from = text(row.src_id) || text(row.source_id) || text(row.from) || text(row.from_id);
    const to = text(row.dst_id) || text(row.target_id) || text(row.to) || text(row.to_id);
    if (!from || !to) return null;
    const raw_weight = Number(row.weight ?? 1);
    return {
        source_id: text(row.id) || text(row.relation_id) || `relation:${index + 1}`,
        from,
        to,
        type: (text(row.type) || text(row.relation) || text(row.kind) || 'refers_to').toLowerCase(),
        weight: Number.isFinite(raw_weight) ? Math.max(0, raw_weight) : 1,
        at: timestamp(row.updated_at ?? row.created_at, index + 1),
    };
}

export function clean_legacy_data(input: legacy_read_result): clean_legacy_result {
    const candidates: clean_legacy_record[] = [];
    const skipped = [...input.skipped];
    input.records.forEach((value, index) => {
        const cleaned = clean_one(value, index);
        if ('reason' in cleaned) skipped.push(cleaned);
        else candidates.push(cleaned);
    });
    candidates.sort((left, right) => left.observed_at - right.observed_at || left.source_id.localeCompare(right.source_id));
    const records: clean_legacy_record[] = [];
    const duplicates: legacy_duplicate[] = [];
    const canonical_ids = new Map<string, string>();
    const by_content = new Map<string, clean_legacy_record>();
    for (const item of candidates) {
        const key = `${item.user_id}\0${item.text.toLowerCase().normalize('NFKC')}`;
        const prior = by_content.get(key);
        if (!prior) {
            by_content.set(key, item);
            records.push(item);
            canonical_ids.set(item.source_id, item.source_id);
            continue;
        }
        const canonical = prior.valid_to !== null && item.valid_to === null ? item : prior;
        const duplicate = canonical === item ? prior : item;
        if (canonical === item) {
            records.splice(records.indexOf(prior), 1, item);
            by_content.set(key, item);
            canonical_ids.set(prior.source_id, item.source_id);
        }
        canonical_ids.set(item.source_id, canonical.source_id);
        canonical_ids.set(duplicate.source_id, canonical.source_id);
        duplicates.push({ duplicate_id: duplicate.source_id, canonical_id: canonical.source_id, reason: 'normalized_content_match' });
    }
    const relations = input.relations.map(clean_relation).filter((item): item is clean_legacy_relation => item !== null);
    return { records, relations, duplicates, canonical_ids, skipped, errors: [...input.errors] };
}