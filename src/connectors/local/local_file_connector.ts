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
 *  file  : src/connectors/local/local_file_connector.ts
 *  usage : implements the LongMemory local file connector component
 */


import type { connector_map_context, ConnectorSyncItem, HydrographImportPlan } from '../../core/connectors/source_event.js';
import { filesystem_transport, type filesystem_transport_options } from '../transports/filesystem.js';
import { adapter_connector } from '../adapter_connector.js';
import { world } from '../plan_helpers.js';
import { map_docs_to_hydrograph } from '../docs/docs_mapper.js';

export class local_file_connector extends adapter_connector {
    readonly id: string = 'local';
    readonly name: string = 'Local folders';
    readonly source_type: string = 'local_file';

    constructor(options: filesystem_transport_options) {
        super(new filesystem_transport(options));
    }

    async mapToHydrograph(item: ConnectorSyncItem, context: connector_map_context): Promise<HydrographImportPlan> {
        const plan = await map_docs_to_hydrograph(this.id, item, context);
        if (!item.document) return plan;
        const source_item = item.document.metadata.source_item as { path?: string | null } | undefined;
        const path = source_item?.path ?? item.ref.metadata.path as string | undefined ?? '';
        const folders = path.split('/').slice(0, -1).filter(Boolean);
        let parent: string | null = null;
        for (let index = 0; index < folders.length; index++) {
            const key = `folder:${folders.slice(0, index + 1).join('/')}`;
            plan.worlds_to_create.unshift(world(key, folders[index], item.recorded_at, parent, {
                path: folders.slice(0, index + 1).join('/'), connector_kind: 'folder',
            }, item.document.permissions));
            parent = key;
        }
        const document_world = plan.worlds_to_create.find((planned_world) => planned_world.key === `document:${item.document?.external_id}`);
        if (document_world) document_world.parent_key = parent;
        for (const planned of plan.nodes_to_create) {
            planned.metadata.file_path = path;
            planned.metadata.modified_at = item.document.updated_at;
        }
        return plan;
    }
}