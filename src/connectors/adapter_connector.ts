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
 *  file  : src/connectors/adapter_connector.ts
 *  usage : implements the LongMemory adapter connector component
 */


import type { Connector, connector_config, connector_list_params, connector_sync_params } from '../core/connectors/connector.js';
import { public_permission, type connector_permission } from '../core/connectors/permission.js';
import type { SourceDocument, SourceRef, source_ref_kind } from '../core/connectors/source_document.js';
import type { ConnectorSyncItem, HydrographImportPlan, connector_fetch_result, connector_map_context } from '../core/connectors/source_event.js';
import { memory_cursor_store, type SyncCursor } from '../core/connectors/sync_cursor.js';
import type { source_adapter, source_document, source_item, source_item_kind } from './transports/types.js';

const kind_map: Record<source_item_kind, source_ref_kind> = {
    repository: 'repository', directory: 'folder', file: 'file', issue: 'issue', pull_request: 'pull_request', commit: 'commit',
    release: 'document', page: 'page', document: 'document', message: 'message', record: 'document', feed_entry: 'page',
};
const source_kinds = (kinds: SourceRef['kind'][] | undefined): source_item_kind[] | undefined => kinds?.flatMap((kind) =>
    Object.entries(kind_map).filter(([, mapped]) => mapped === kind).map(([source_kind]) => source_kind as source_item_kind));

export abstract class adapter_connector implements Connector {
    abstract readonly id: string;
    abstract readonly name: string;
    abstract readonly source_type: string;
    protected readonly cursor_store = new memory_cursor_store();
    protected permission: connector_permission = public_permission();
    private connected = false;

    constructor(protected readonly adapter: source_adapter) {}

    async connect(config: connector_config = {}): Promise<void> {
        if (config.permission) this.permission = structuredClone(config.permission as connector_permission);
        await this.adapter.connect(config.credentials as Record<string, string | undefined> | undefined);
        this.connected = true;
    }

    async testConnection(): Promise<boolean> {
        try {
            if (!this.connected) await this.connect();
            await this.adapter.list({ limit: 1 });
            return true;
        } catch {
            return false;
        }
    }

    async listSources(params: connector_list_params = {}): Promise<SourceRef[]> {
        if (!this.connected) await this.connect();
        const page = await this.adapter.list({ limit: params.limit, cursor: params.cursor, since: params.since ? new Date(params.since).toISOString() : undefined, kinds: source_kinds(params.kinds) }, { signal: params.signal });
        return page.items.map((item) => this.ref(item));
    }

    async fetchSource(ref: SourceRef): Promise<connector_fetch_result> {
        const document = await this.adapter.fetch(ref.external_id);
        return this.document(document);
    }

    async *sync(params: connector_sync_params): AsyncIterable<ConnectorSyncItem> {
        const refs = await this.listSources({ limit: params.limit, since: params.since, kinds: params.kinds, signal: params.signal });
        const seen = new Set<string>();
        for (const ref of refs) {
            params.signal?.throwIfAborted();
            seen.add(ref.external_id);
            const prior = params.cursor?.items[ref.external_id] ?? null;
            if (params.mode === 'incremental' && prior && ref.checksum && prior.checksum === ref.checksum) {
                yield this.event('unchanged', ref, null, prior.checksum);
                continue;
            }
            const document = await this.fetchSource(ref) as SourceDocument;
            const event = prior ? prior.checksum === document.checksum ? 'unchanged' : 'updated' : 'created';
            yield this.event(event, ref, document, prior?.checksum ?? null);
        }
        if (params.mode === 'incremental' && params.cursor) {
            for (const [external_id, prior] of Object.entries(params.cursor.items)) {
                if (seen.has(external_id) || prior.deleted) continue;
                const ref: SourceRef = {
                    source_type: this.source_type, external_id, kind: 'document', title: external_id, url: null,
                    parent_external_id: null, version: prior.version, checksum: prior.checksum, updated_at: null, metadata: {},
                };
                yield this.event('deleted', ref, null, prior.checksum);
            }
        }
    }

    getCursor(): Promise<SyncCursor | null> {
        return this.cursor_store.get();
    }

    setCursor(cursor: SyncCursor): Promise<void> {
        return this.cursor_store.set(cursor);
    }

    abstract mapToHydrograph(item: ConnectorSyncItem, context: connector_map_context): Promise<HydrographImportPlan>;

    protected ref(item: source_item): SourceRef {
        return {
            source_type: this.source_type,
            external_id: item.id,
            kind: kind_map[item.kind],
            title: item.name,
            url: item.uri,
            parent_external_id: item.path?.includes('/') ? item.path.slice(0, item.path.lastIndexOf('/')) : null,
            version: item.etag,
            checksum: item.etag,
            updated_at: item.updated_at ? Date.parse(item.updated_at) : null,
            metadata: { ...item.metadata, path: item.path, size: item.size, mime_type: item.mime_type, item_kind: item.kind },
        };
    }

    protected document(value: source_document): SourceDocument {
        const checksum = value.analysis?.sha256 || value.item.etag || `${value.item.id}:${value.item.updated_at ?? ''}:${value.data.length}`;
        return {
            id: `${this.id}:${value.item.id}:${checksum}`,
            source_type: this.source_type,
            external_id: value.item.id,
            url: value.item.uri,
            title: value.item.name,
            author: typeof value.metadata.author === 'string' ? value.metadata.author : null,
            created_at: value.item.created_at ? Date.parse(value.item.created_at) : null,
            updated_at: value.item.updated_at ? Date.parse(value.item.updated_at) : null,
            fetched_at: Date.now(),
            content: value.text,
            metadata: { ...value.metadata, source_item: value.item, analysis: value.analysis },
            permissions: structuredClone(this.permission),
            version: value.item.etag ?? checksum,
            checksum,
        };
    }

    private event(event: ConnectorSyncItem['event'], ref: SourceRef, document: SourceDocument | null, previous_checksum: string | null): ConnectorSyncItem {
        const recorded_at = Date.now();
        return {
            id: `${this.id}:${event}:${ref.external_id}:${document?.checksum ?? ref.checksum ?? recorded_at}`,
            source_type: this.source_type,
            external_id: ref.external_id,
            event,
            recorded_at,
            ref,
            document,
            previous_checksum,
            metadata: {},
        };
    }
}