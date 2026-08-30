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
 *  file  : src/core/connectors/connector_ingest.ts
 *  usage : implements the LongMemory connector ingest component
 */

import type { long_memory } from '../create_memory.js';
import type { Connector } from './connector.js';
import { public_permission, type connector_permission } from './permission.js';
import { empty_cursor, type SyncCursor } from './sync_cursor.js';
import type { ConnectorSyncItem, HydrographImportPlan } from './source_event.js';

export type connector_sync_options = {
    mode?: 'full' | 'incremental';
    dry_run?: boolean;
    retry_failed?: number;
    default_permission?: connector_permission;
    signal?: AbortSignal;
    now?: () => number;
    transform_plan?: (plan: HydrographImportPlan, item: ConnectorSyncItem) => HydrographImportPlan | Promise<HydrographImportPlan>;
};

export type connector_sync_report = {
    connector_id: string;
    mode: 'full' | 'incremental';
    dry_run: boolean;
    discovered: number;
    created: number;
    updated: number;
    deleted: number;
    unchanged: number;
    permission_changed: number;
    moved: number;
    renamed: number;
    applied_plans: number;
    node_ids: string[];
    edge_ids: string[];
    world_ids: string[];
    plans: HydrographImportPlan[];
    failures: Array<{ item_id: string; attempts: number; message: string }>;
    cursor: SyncCursor;
    started_at: number;
    completed_at: number;
};

export async function sync_connector(connector: Connector, memory: long_memory, options: connector_sync_options = {}): Promise<connector_sync_report> {
    const now = options.now ?? Date.now;
    const started_at = now();
    const mode = options.mode ?? 'incremental';
    const cursor = mode === 'full' ? empty_cursor(connector.id, started_at) : await connector.getCursor() ?? empty_cursor(connector.id, started_at);
    const report: connector_sync_report = {
        connector_id: connector.id, mode, dry_run: options.dry_run ?? false, discovered: 0,
        created: 0, updated: 0, deleted: 0, unchanged: 0, permission_changed: 0, moved: 0, renamed: 0,
        applied_plans: 0, node_ids: [], edge_ids: [], world_ids: [], plans: [], failures: [], cursor,
        started_at, completed_at: started_at,
    };
    const retries = Math.max(0, options.retry_failed ?? 2);
    for await (const item of connector.sync({ mode, cursor, signal: options.signal })) {
        options.signal?.throwIfAborted();
        report.discovered++;
        report[item.event]++;
        if (item.event === 'unchanged') continue;
        const previous = cursor.items[item.external_id] ?? null;
        let last: unknown;
        let plan: HydrographImportPlan | null = null;
        for (let attempt = 1; attempt <= retries + 1; attempt++) {
            try {
                if (!plan) {
                    const mapped = await connector.mapToHydrograph(item, {
                        connector_id: connector.id,
                        source_type: connector.source_type,
                        now: now(),
                        previous: previous ? { checksum: previous.checksum, node_ids: previous.node_ids, version: previous.version } : null,
                        default_permission: options.default_permission ?? public_permission(),
                    });
                    plan = options.transform_plan ? await options.transform_plan(mapped, item) : mapped;
                    report.plans.push(plan);
                }
                if (!report.dry_run) {
                    const applied = await memory.applyImportPlan(plan);
                    report.applied_plans++;
                    report.node_ids.push(...applied.node_ids);
                    report.edge_ids.push(...applied.edge_ids);
                    report.world_ids.push(...applied.world_ids);
                    cursor.items[item.external_id] = {
                        checksum: plan.checksum,
                        version: item.document?.version ?? item.ref.version ?? plan.checksum,
                        node_ids: applied.node_ids,
                        synced_at: now(),
                        deleted: item.event === 'deleted',
                    };
                    cursor.position = item.id;
                    cursor.updated_at = now();
                    await connector.setCursor(cursor);
                }
                last = null;
                break;
            } catch (error) {
                last = error;
            }
        }
        if (last) report.failures.push({ item_id: item.id, attempts: retries + 1, message: last instanceof Error ? last.message : String(last) });
    }
    report.completed_at = now();
    return report;
}