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
 *  file  : src/core/connectors/source_document.ts
 *  usage : implements the LongMemory source document component
 */

import type { connector_permission } from './permission.js';

export type source_ref_kind = 'video' | 'repository' | 'issue' | 'pull_request' | 'commit' | 'document' | 'page' | 'message' | 'file' | 'folder';

export type SourceRef = {
    source_type: string;
    external_id: string;
    kind: source_ref_kind;
    title: string;
    url: string | null;
    parent_external_id: string | null;
    version: string | null;
    checksum: string | null;
    updated_at: number | null;
    metadata: Record<string, unknown>;
};

export type SourceDocument = {
    id: string;
    source_type: string;
    external_id: string;
    url: string | null;
    title: string;
    author: string | null;
    created_at: number | null;
    updated_at: number | null;
    fetched_at: number;
    content: string;
    metadata: Record<string, unknown>;
    permissions: connector_permission;
    version: string;
    checksum: string;
};