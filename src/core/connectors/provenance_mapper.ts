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
 *  file  : src/core/connectors/provenance_mapper.ts
 *  usage : implements the LongMemory provenance mapper component
 */

import type { Provenance } from '../types/provenance.js';
import type { SourceDocument } from './source_document.js';

export function map_connector_provenance(connector_id: string, document: SourceDocument): Provenance {
    return {
        created_by: `connector:${connector_id}`,
        extraction_method: 'import',
        source_trace: [{ source_id: `${document.source_type}:${document.external_id}`, ref: document.url, at: document.fetched_at }],
    };
}

export function citation_metadata(document: SourceDocument, extra: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        source_type: document.source_type,
        external_id: document.external_id,
        url: document.url,
        author: document.author,
        version: document.version,
        checksum: document.checksum,
        fetched_at: document.fetched_at,
        ...extra,
    };
}