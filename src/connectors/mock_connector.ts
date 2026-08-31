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
 *  file  : src/connectors/mock_connector.ts
 *  usage : implements the LongMemory mock connector component
 */


import type { Connector, connector_config, connector_list_params, connector_sync_params } from '../core/connectors/connector.js';
import type { SourceDocument, SourceRef, source_ref_kind } from '../core/connectors/source_document.js';
import type { ConnectorSyncItem, HydrographImportPlan, connector_fetch_result, connector_map_context } from '../core/connectors/source_event.js';
import { memory_cursor_store, type SyncCursor } from '../core/connectors/sync_cursor.js';
import { map_docs_to_hydrograph } from './docs/docs_mapper.js';

export class mock_connector implements Connector {
    private documents = new Map<string, SourceDocument>();
    private readonly cursor = new memory_cursor_store();

    constructor(
        readonly id: string,
        readonly name: string,
        readonly source_type: string,
        private readonly kind: source_ref_kind = 'document',
        private readonly mapper: (connector_id: string, item: ConnectorSyncItem, context: connector_map_context) => Promise<HydrographImportPlan> = map_docs_to_hydrograph,
    ) {}

    async connect(config: connector_config = {}): Promise<void> {
        this.documents.clear();
        for (const document of (config.documents as SourceDocument[] | undefined) ?? []) this.documents.set(document.external_id, structuredClone(document));
    }
    async testConnection(): Promise<boolean> { return true; }
    async listSources(params: connector_list_params = {}): Promise<SourceRef[]> {
        return [...this.documents.values()].slice(0, params.limit ?? this.documents.size).map((document) => ({ source_type: this.source_type, external_id: document.external_id, kind: this.kind, title: document.title, url: document.url, parent_external_id: null, version: document.version, checksum: document.checksum, updated_at: document.updated_at, metadata: document.metadata }));
    }
    async fetchSource(ref: SourceRef): Promise<connector_fetch_result> {
        const document = this.documents.get(ref.external_id);
        if (!document) throw new Error(`${this.name} source not found: ${ref.external_id}`);
        return structuredClone(document);
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
            const ref: SourceRef = { source_type: this.source_type, external_id, kind: this.kind, title: external_id, url: null, parent_external_id: null, version: prior.version, checksum: prior.checksum, updated_at: null, metadata: {} };
            yield { id: `${this.id}:deleted:${external_id}`, source_type: this.source_type, external_id, event: 'deleted', recorded_at: Date.now(), ref, document: null, previous_checksum: prior.checksum, metadata: {} };
        }
    }
    getCursor(): Promise<SyncCursor | null> { return this.cursor.get(); }
    setCursor(cursor: SyncCursor): Promise<void> { return this.cursor.set(cursor); }
    mapToHydrograph(item: ConnectorSyncItem, context: connector_map_context): Promise<HydrographImportPlan> { return this.mapper(this.id, item, context); }
}