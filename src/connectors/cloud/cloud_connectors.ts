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
 *  file  : src/connectors/cloud/cloud_connectors.ts
 *  usage : implements the LongMemory cloud connectors component
 */

import type { connector_map_context, ConnectorSyncItem, HydrographImportPlan } from '../../core/connectors/source_event.js';
import { adapter_connector } from '../adapter_connector.js';
import { map_docs_to_hydrograph } from '../docs/docs_mapper.js';
import { google_workspace_transport, notion_transport, onedrive_transport, type cloud_transport_options } from './cloud_transports.js';

abstract class cloud_document_connector extends adapter_connector {
    abstract readonly id: string;
    abstract readonly name: string;
    abstract readonly source_type: string;
    mapToHydrograph(item: ConnectorSyncItem, context: connector_map_context): Promise<HydrographImportPlan> { return map_docs_to_hydrograph(this.id, item, context); }
}

export class google_drive_connector extends cloud_document_connector {
    readonly id = 'google_drive'; readonly name = 'Google Drive'; readonly source_type = 'google_drive';
    constructor(options: cloud_transport_options = {}) { super(new google_workspace_transport('drive', options)); }
}
export class google_sheets_connector extends cloud_document_connector {
    readonly id = 'google_sheets'; readonly name = 'Google Sheets'; readonly source_type = 'google_sheets';
    constructor(options: cloud_transport_options = {}) { super(new google_workspace_transport('sheets', options)); }
}
export class google_slides_connector extends cloud_document_connector {
    readonly id = 'google_slides'; readonly name = 'Google Slides'; readonly source_type = 'google_slides';
    constructor(options: cloud_transport_options = {}) { super(new google_workspace_transport('slides', options)); }
}
export class onedrive_connector extends cloud_document_connector {
    readonly id = 'onedrive'; readonly name = 'OneDrive'; readonly source_type = 'onedrive';
    constructor(options: cloud_transport_options = {}) { super(new onedrive_transport(options)); }
}
export class notion_connector extends cloud_document_connector {
    readonly id = 'notion'; readonly name = 'Notion'; readonly source_type = 'notion';
    constructor(options: cloud_transport_options = {}) { super(new notion_transport(options)); }
}