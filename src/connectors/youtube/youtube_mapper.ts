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
 *  file  : src/connectors/youtube/youtube_mapper.ts
 *  usage : timestamp-preserving YouTube Hydrograph plans
 */

import type { connector_map_context, ConnectorSyncItem, HydrographImportPlan } from '../../core/connectors/source_event.js';
import { add_update_actions, deletion_plan, edge, empty_plan, hash, node, world } from '../plan_helpers.js';

export type youtube_segment = { start_seconds: number; duration_seconds: number | null; text: string; speaker?: string | null };

export async function map_youtube_to_hydrograph(connector_id: string, item: ConnectorSyncItem, context: connector_map_context): Promise<HydrographImportPlan> {
    if (item.event === 'deleted') return deletion_plan(connector_id, item, context);
    const document = item.document;
    if (!document) throw new Error(`YouTube item ${item.id} has no document`);
    const plan = empty_plan(connector_id, item);
    const world_key = `video:${document.external_id}`;
    const channel = typeof document.metadata.channel === 'string' ? document.metadata.channel : document.author;
    const topics = Array.isArray(document.metadata.topics) ? document.metadata.topics.filter((value): value is string => typeof value === 'string') : [];
    const entities = [
        ...(channel ? [{ name: channel, type: 'organization' as const, observed_at: document.updated_at ?? document.fetched_at, metadata: { role: 'youtube_channel' } }] : []),
        ...topics.map((name) => ({ name, type: 'concept' as const, observed_at: document.updated_at ?? document.fetched_at })),
    ];
    plan.worlds_to_create.push(world(world_key, document.title, document.created_at ?? item.recorded_at, null, {
        video_id: document.external_id, url: document.url, channel, duration_seconds: document.metadata.duration_seconds,
    }, document.permissions));
    const video = node(connector_id, document, 'video', world_key, `Video: ${document.title}\n${document.metadata.description ?? ''}`, {
        checksum: document.checksum, facet: 'semantic', entities, metadata: { video_root: true, citation: { url: document.url, video_id: document.external_id } },
    });
    plan.nodes_to_create.push(video);
    const segments = Array.isArray(document.metadata.transcript) ? document.metadata.transcript as youtube_segment[] : [];
    segments.forEach((segment, index) => {
        const key = `segment:${index}:${segment.start_seconds}`;
        const timestamp_url = document.url ? `${document.url}${document.url.includes('?') ? '&' : '?'}t=${Math.floor(segment.start_seconds)}s` : null;
        const segment_document = { ...document, url: timestamp_url };
        plan.nodes_to_create.push(node(connector_id, segment_document, key, world_key, segment.text, {
            title: `${document.title} @ ${segment.start_seconds}s`,
            checksum: hash(`${segment.start_seconds}|${segment.duration_seconds}|${segment.text}`),
            facet: 'semantic',
            timestamp_seconds: segment.start_seconds,
            entities: segment.speaker ? [{ name: segment.speaker, type: 'person', observed_at: document.updated_at ?? document.fetched_at, metadata: { role: 'speaker' } }] : [],
            metadata: { start_seconds: segment.start_seconds, duration_seconds: segment.duration_seconds, speaker: segment.speaker ?? null, citation: { url: timestamp_url, video_id: document.external_id, timestamp_seconds: segment.start_seconds } },
        }));
        plan.edges_to_create.push(edge(`contains:${key}`, 'video', key, 'contains', item.recorded_at, { timestamp_seconds: segment.start_seconds }));
    });
    plan.entities_to_resolve.push(...entities, ...plan.nodes_to_create.flatMap((planned) => planned.entities));
    plan.contracts.push(...plan.nodes_to_create.map((planned) => ({ node_key: planned.key, contract: planned.contract })));
    plan.provenance.push(...plan.nodes_to_create.map((planned) => planned.provenance));
    plan.grounding_refs.push(...plan.nodes_to_create.map((planned) => ({ node_key: planned.key, source: planned.grounding_source, ref: planned.url ?? document.external_id })));
    if (item.event === 'updated' || item.event === 'permission_changed') add_update_actions(plan, context, 'video', document.external_id, item.recorded_at);
    return plan;
}