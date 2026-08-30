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
 *  file  : src/connectors/plan_helpers.ts
 *  usage : implements the LongMemory plan helpers component
 */

import { createHash } from 'node:crypto';
import { permission_contract } from '../core/connectors/permission.js';
import type { SourceDocument } from '../core/connectors/source_document.js';
import type { ConnectorSyncItem, HydrographImportPlan, connector_map_context, planned_edge, planned_node, planned_world } from '../core/connectors/source_event.js';
import type { EntityMention } from '../core/types/entity.js';
import type { FacetName } from '../core/types/facets.js';

export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const stable = (value: string) => encodeURIComponent(value).replace(/%/g, '').slice(0, 160);

export const world = (key: string, name: string, at: number, parent_key: string | null, metadata: Record<string, unknown>, permission: SourceDocument['permissions']): planned_world => ({
    key,
    name,
    parent_key,
    zone: 'exocortex',
    contracts: { source_required: true, expires_if_unconfirmed: true, ...permission_contract(permission) },
    metadata,
    created_at: at,
});

export function node(
    connector_id: string,
    document: SourceDocument,
    key: string,
    world_key: string,
    content: string,
    options: { title?: string; checksum?: string; facet?: FacetName; entities?: EntityMention[]; metadata?: Record<string, unknown>; timestamp_seconds?: number | null; valid_to?: number | null } = {},
): planned_node {
    const checksum = options.checksum ?? hash(content);
    const observed_at = document.updated_at ?? document.created_at ?? document.fetched_at;
    return {
        key,
        id: `connector:${connector_id}:${stable(document.external_id)}:${stable(key)}:${checksum.slice(0, 16)}`,
        source_type: document.source_type,
        external_id: document.external_id,
        title: options.title ?? document.title,
        content,
        world_key,
        zone: 'exocortex',
        facet: options.facet ?? 'semantic',
        valid_from: document.created_at ?? observed_at,
        valid_to: options.valid_to ?? null,
        observed_at,
        recorded_at: document.fetched_at,
        version: document.version,
        checksum,
        url: document.url,
        timestamp_seconds: options.timestamp_seconds ?? null,
        permission: document.permissions,
        contract: { source_required: true, expires_if_unconfirmed: true, ...permission_contract(document.permissions) },
        provenance: {
            connector_id,
            source_type: document.source_type,
            external_id: document.external_id,
            url: document.url,
            version: document.version,
            checksum,
            recorded_at: document.fetched_at,
            metadata: options.metadata ?? {},
        },
        entities: options.entities ?? [],
        grounding_source: { id: connector_id, kind: document.source_type === 'local_file' ? 'document' : 'api', reliability: 0.8 },
        metadata: { ...document.metadata, ...options.metadata },
    };
}

export const edge = (key: string, from: string, to: string, type: planned_edge['type'], at: number, metadata: Record<string, unknown> = {}): planned_edge => ({
    key, from, to, type, confidence: 0.95, weight: 1, valid_from: at, valid_to: null, observed_at: at, recorded_at: at, metadata,
});

export function empty_plan(connector_id: string, item: ConnectorSyncItem): HydrographImportPlan {
    return {
        connector_id,
        source_type: item.source_type,
        sync_item_id: item.id,
        recorded_at: item.recorded_at,
        nodes_to_create: [],
        edges_to_create: [],
        worlds_to_create: [],
        entities_to_resolve: [],
        grounding_refs: [],
        contracts: [],
        provenance: [],
        deletion_or_supersession_actions: [],
        checksum: item.document?.checksum ?? item.ref.checksum ?? hash(item.id),
        warnings: [],
    };
}

export function add_update_actions(plan: HydrographImportPlan, context: connector_map_context, replacement_key: string, external_id: string, at: number): void {
    for (const target_node_id of context.previous?.node_ids ?? []) {
        plan.deletion_or_supersession_actions.push({ type: 'supersede', target_node_id, replacement_node_key: replacement_key, external_id, recorded_at: at, reason: 'external source updated' });
    }
}

export function deletion_plan(connector_id: string, item: ConnectorSyncItem, context: connector_map_context): HydrographImportPlan {
    const plan = empty_plan(connector_id, item);
    for (const target_node_id of context.previous?.node_ids ?? []) {
        plan.deletion_or_supersession_actions.push({ type: 'source_deleted', target_node_id, replacement_node_key: null, external_id: item.external_id, recorded_at: item.recorded_at, reason: 'external source deleted' });
    }
    if (!context.previous?.node_ids.length) plan.warnings.push('deleted source had no previously imported nodes');
    return plan;
}