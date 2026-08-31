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
 *  file  : src/connectors/youtube/youtube_connector.ts
 *  usage : implements the LongMemory youtube connector component
 */


import type { Connector, connector_config, connector_list_params, connector_sync_params } from '../../core/connectors/connector.js';
import type { SourceDocument, SourceRef } from '../../core/connectors/source_document.js';
import type { ConnectorSyncItem, HydrographImportPlan, connector_fetch_result, connector_map_context } from '../../core/connectors/source_event.js';
import { memory_cursor_store, type SyncCursor } from '../../core/connectors/sync_cursor.js';
import { map_youtube_to_hydrograph } from './youtube_mapper.js';

export class youtube_connector implements Connector {
    readonly id = 'youtube';
    readonly name = 'YouTube';
    readonly source_type = 'youtube';
    private videos = new Map<string, SourceDocument>();
    private readonly cursor = new memory_cursor_store();

    async connect(config: connector_config = {}): Promise<void> {
        this.videos.clear();
        for (const document of (config.videos as SourceDocument[] | undefined) ?? []) this.videos.set(document.external_id, structuredClone(document));
    }
    async testConnection(): Promise<boolean> { return true; }
    async listSources(params: connector_list_params = {}): Promise<SourceRef[]> {
        return [...this.videos.values()].slice(0, params.limit ?? this.videos.size).map((video) => ({ source_type: this.source_type, external_id: video.external_id, kind: 'video', title: video.title, url: video.url, parent_external_id: null, version: video.version, checksum: video.checksum, updated_at: video.updated_at, metadata: video.metadata }));
    }
    async fetchSource(ref: SourceRef): Promise<connector_fetch_result> {
        const video = this.videos.get(ref.external_id);
        if (!video) throw new Error(`YouTube video not found: ${ref.external_id}`);
        return structuredClone(video);
    }
    async *sync(params: connector_sync_params): AsyncIterable<ConnectorSyncItem> {
        const seen = new Set<string>();
        for (const ref of await this.listSources({ limit: params.limit, since: params.since, kinds: params.kinds, signal: params.signal })) {
            seen.add(ref.external_id);
            const document = await this.fetchSource(ref) as SourceDocument;
            const prior = params.cursor?.items[ref.external_id] ?? null;
            const event = prior ? prior.checksum === document.checksum ? 'unchanged' : 'updated' : 'created';
            yield { id: `${this.id}:${event}:${ref.external_id}:${document.checksum}`, source_type: this.source_type, external_id: ref.external_id, event, recorded_at: document.fetched_at, ref, document, previous_checksum: prior?.checksum ?? null, metadata: {} };
        }
        for (const [external_id, prior] of Object.entries(params.cursor?.items ?? {})) {
            if (seen.has(external_id) || prior.deleted) continue;
            const ref: SourceRef = { source_type: this.source_type, external_id, kind: 'video', title: external_id, url: null, parent_external_id: null, version: prior.version, checksum: prior.checksum, updated_at: null, metadata: {} };
            yield { id: `${this.id}:deleted:${external_id}`, source_type: this.source_type, external_id, event: 'deleted', recorded_at: Date.now(), ref, document: null, previous_checksum: prior.checksum, metadata: {} };
        }
    }
    getCursor(): Promise<SyncCursor | null> { return this.cursor.get(); }
    setCursor(cursor: SyncCursor): Promise<void> { return this.cursor.set(cursor); }
    mapToHydrograph(item: ConnectorSyncItem, context: connector_map_context): Promise<HydrographImportPlan> { return map_youtube_to_hydrograph(this.id, item, context); }
}