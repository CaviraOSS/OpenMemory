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
 *  file  : src/core/connectors/provenance_mapper.ts
 *  usage : connector provenance and citation metadata
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