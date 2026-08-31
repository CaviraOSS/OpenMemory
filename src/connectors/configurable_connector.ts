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
 *  file  : src/connectors/configurable_connector.ts
 *  usage : implements the LongMemory configurable connector component
 */


import type { connector_map_context, ConnectorSyncItem, HydrographImportPlan } from '../core/connectors/source_event.js';
import type { service_connector_definition } from './service_catalog.js';
import { adapter_connector } from './adapter_connector.js';
import { map_docs_to_hydrograph } from './docs/docs_mapper.js';
import { map_chat_to_hydrograph, map_issue_tracker_to_hydrograph, map_record_to_hydrograph } from './domain_mapper.js';
import { rest_transport, type rest_transport_options } from './transports/rest.js';

export type configurable_connector_options = Omit<rest_transport_options, 'id' | 'display_name' | 'token_env' | 'capabilities'>;

export class configurable_connector extends adapter_connector {
    readonly id: string;
    readonly name: string;
    readonly source_type: string;

    constructor(readonly definition: service_connector_definition, options: configurable_connector_options) {
        super(new rest_transport({
            id: definition.id,
            display_name: definition.name,
            capabilities: ['list', 'fetch', 'search', 'changes'],
            token_env: definition.credential_env,
            ...options,
        }));
        this.id = definition.id;
        this.name = definition.name;
        this.source_type = definition.source_type;
    }

    mapToHydrograph(item: ConnectorSyncItem, context: connector_map_context): Promise<HydrographImportPlan> {
        if (this.definition.category === 'project') return map_issue_tracker_to_hydrograph(this.id, item, context);
        if (this.definition.category === 'communication') return map_chat_to_hydrograph(this.id, item, context);
        if (this.definition.category === 'database') return map_record_to_hydrograph(this.id, item, context);
        return map_docs_to_hydrograph(this.id, item, context);
    }
}