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
 *  file  : src/core/connectors/connector.ts
 *  usage : implements the LongMemory connector component
 */

import type { connector_map_context, ConnectorSyncItem, HydrographImportPlan, connector_fetch_result } from './source_event.js';
import type { SourceRef } from './source_document.js';
import type { SyncCursor } from './sync_cursor.js';

export type connector_config = Record<string, unknown>;
export type connector_list_params = { limit?: number; cursor?: string | null; since?: number; kinds?: SourceRef['kind'][]; signal?: AbortSignal };
export type connector_sync_params = Omit<connector_list_params, 'cursor'> & { mode: 'full' | 'incremental'; cursor: SyncCursor | null };

export interface Connector {
    readonly id: string;
    readonly name: string;
    readonly source_type: string;
    connect(config: connector_config): Promise<void>;
    testConnection(): Promise<boolean>;
    listSources(params?: connector_list_params): Promise<SourceRef[]>;
    fetchSource(ref: SourceRef): Promise<connector_fetch_result>;
    sync(params: connector_sync_params): AsyncIterable<ConnectorSyncItem>;
    getCursor(): Promise<SyncCursor | null>;
    setCursor(cursor: SyncCursor): Promise<void>;
    mapToHydrograph(item: ConnectorSyncItem, context: connector_map_context): Promise<HydrographImportPlan>;
}

export type connector_factory = (config?: connector_config) => Connector;