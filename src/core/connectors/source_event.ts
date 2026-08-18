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
 *  file  : src/core/connectors/source_event.ts
 *  usage : connector sync events and Hydrograph import plans
 */

import type { GroundingSource } from '../grounding/exocortex.js';
import type { Contract } from '../types/contract.js';
import type { EntityMention } from '../types/entity.js';
import type { FacetName } from '../types/facets.js';
import type { Zone } from '../types/hydro_node.js';
import type { WorldZone } from '../types/world.js';
import type { connector_permission } from './permission.js';
import type { SourceDocument, SourceRef } from './source_document.js';

export type source_event_kind = 'created' | 'updated' | 'deleted' | 'unchanged' | 'permission_changed' | 'moved' | 'renamed';

export type SourceEvent = {
    id: string;
    source_type: string;
    external_id: string;
    event: source_event_kind;
    recorded_at: number;
    ref: SourceRef;
    document: SourceDocument | null;
    previous_checksum: string | null;
    metadata: Record<string, unknown>;
};

export type ConnectorSyncItem = SourceEvent;

export type planned_world = {
    key: string;
    name: string;
    parent_key: string | null;
    parent_world_id?: string | null;
    zone: WorldZone;
    contracts: Partial<Contract>;
    metadata: Record<string, unknown>;
    created_at: number;
};

export type planned_node = {
    key: string;
    id: string;
    source_type: string;
    external_id: string;
    title: string;
    content: string;
    world_key: string;
    zone: Zone;
    facet: FacetName;
    valid_from: number;
    valid_to: number | null;
    observed_at: number;
    recorded_at: number;
    version: string;
    checksum: string;
    url: string | null;
    timestamp_seconds: number | null;
    permission: connector_permission;
    contract: Partial<Contract>;
    provenance: {
        connector_id: string;
        source_type: string;
        external_id: string;
        url: string | null;
        version: string;
        checksum: string;
        recorded_at: number;
        metadata: Record<string, unknown>;
    };
    entities: EntityMention[];
    grounding_source: GroundingSource;
    metadata: Record<string, unknown>;
    conflict_behavior?: 'auto' | 'supersede' | 'contradict' | 'none';
};

export type planned_edge = {
    key: string;
    from: string;
    to: string;
    type: 'contains' | 'refers_to' | 'same_as' | 'supports' | 'contradicts' | 'supersedes' | 'derived_from' | 'grounds' | 'semantic_shift';
    confidence: number;
    weight: number;
    valid_from: number;
    valid_to: number | null;
    observed_at: number;
    recorded_at: number;
    metadata: Record<string, unknown>;
};

export type deletion_or_supersession_action = {
    type: 'source_deleted' | 'supersede';
    target_node_id: string;
    replacement_node_key: string | null;
    external_id: string;
    recorded_at: number;
    reason: string;
};

export type HydrographImportPlan = {
    connector_id: string;
    source_type: string;
    sync_item_id: string;
    recorded_at: number;
    nodes_to_create: planned_node[];
    edges_to_create: planned_edge[];
    worlds_to_create: planned_world[];
    entities_to_resolve: EntityMention[];
    grounding_refs: Array<{ node_key: string; source: GroundingSource; ref: string }>;
    contracts: Array<{ node_key: string; contract: Partial<Contract> }>;
    provenance: planned_node['provenance'][];
    deletion_or_supersession_actions: deletion_or_supersession_action[];
    checksum: string;
    warnings: string[];
};

export type hydrograph_import_result = {
    plan_id: string;
    node_ids: string[];
    edge_ids: string[];
    world_ids: string[];
    entity_ids: string[];
};

export type connector_map_context = {
    connector_id: string;
    source_type: string;
    now: number;
    previous: { checksum: string; node_ids: string[]; version: string } | null;
    default_permission: connector_permission;
};

export type connector_fetch_result = SourceDocument | SourceEvent;