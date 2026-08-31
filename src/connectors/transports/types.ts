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
 *  file  : src/connectors/transports/types.ts
 *  usage : implements the LongMemory types component
 */


export type source_capability = 'list' | 'fetch' | 'search' | 'changes' | 'repositories' | 'files' | 'issues' | 'pulls' | 'commits' | 'releases' | 'webhooks';
export type source_item_kind = 'repository' | 'directory' | 'file' | 'issue' | 'pull_request' | 'commit' | 'release' | 'page' | 'document' | 'message' | 'record' | 'feed_entry';

export type source_credentials = Record<string, string | undefined>;

export type source_item = {
    id: string;
    source: string;
    kind: source_item_kind;
    name: string;
    uri: string;
    path: string | null;
    mime_type: string | null;
    size: number | null;
    created_at: string | null;
    updated_at: string | null;
    etag: string | null;
    metadata: Record<string, unknown>;
};

export type source_symbol = {
    name: string;
    kind: 'class' | 'interface' | 'type' | 'enum' | 'function' | 'method' | 'variable' | 'module' | 'heading' | 'table' | 'route' | 'unknown';
    line: number;
    end_line: number;
    signature: string;
    exported: boolean;
    calls: string[];
};

export type file_role = 'source' | 'test' | 'documentation' | 'configuration' | 'build' | 'workflow' | 'data' | 'migration' | 'generated' | 'vendor' | 'asset' | 'unknown';

export type file_analysis = {
    language: string;
    extension: string;
    role: file_role;
    binary: boolean;
    generated: boolean;
    minified: boolean;
    line_count: number;
    code_lines: number;
    comment_lines: number;
    blank_lines: number;
    byte_count: number;
    char_count: number;
    sha256: string;
    imports: string[];
    exports: string[];
    dependencies: string[];
    symbols: source_symbol[];
    headings: string[];
    metadata: Record<string, unknown>;
};

export type source_document = {
    item: source_item;
    text: string;
    data: Uint8Array;
    analysis: file_analysis | null;
    metadata: Record<string, unknown>;
};

export type source_query = {
    cursor?: string | null;
    limit?: number;
    path?: string;
    search?: string;
    kinds?: source_item_kind[];
    since?: string;
    include_content?: boolean;
    metadata?: Record<string, unknown>;
};

export type source_page = {
    items: source_item[];
    next_cursor: string | null;
    total: number | null;
    metadata: Record<string, unknown>;
};

export type source_context = {
    signal?: AbortSignal;
    request_id?: string;
};

export interface source_adapter {
    readonly id: string;
    readonly display_name: string;
    readonly capabilities: readonly source_capability[];
    connect(credentials?: source_credentials, context?: source_context): Promise<void>;
    disconnect(): Promise<void>;
    list(query?: source_query, context?: source_context): Promise<source_page>;
    fetch(item_id: string, context?: source_context): Promise<source_document>;
}

