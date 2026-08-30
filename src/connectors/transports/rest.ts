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
 *  file  : src/connectors/transports/rest.ts
 *  usage : implements the LongMemory rest component
 */

import { connector_transport, type connector_transport_options, connector_transport_error } from './base.js';
import { extract_text } from './extractors/file_analysis.js';
import type { source_capability, source_context, source_document, source_item, source_item_kind, source_page, source_query } from './types.js';

export type rest_field_map = {
    id?: string;
    name?: string;
    text?: string;
    uri?: string;
    path?: string;
    kind?: string;
    mime_type?: string;
    size?: string;
    created_at?: string;
    updated_at?: string;
    etag?: string;
};

export type rest_transport_options = connector_transport_options & {
    id: string;
    display_name: string;
    list_url: string;
    item_url?: string;
    response_path?: string;
    next_cursor_path?: string;
    total_path?: string;
    fields?: rest_field_map;
    headers?: Record<string, string>;
    token_env?: string[];
    auth_header?: string;
    auth_prefix?: string;
    capabilities?: source_capability[];
    default_kind?: source_item_kind;
    cursor_parameter?: string;
    limit_parameter?: string;
    search_parameter?: string;
};

const at = (value: unknown, path: string | undefined): any => {
    if (!path) return value;
    return path.split('.').filter(Boolean).reduce<any>((current, key) => current?.[key], value);
};

const string_at = (value: unknown, path: string | undefined, fallback = '') => {
    if (!path) return fallback;
    const found = at(value, path);
    return found === undefined || found === null ? fallback : String(found);
};

export class rest_transport extends connector_transport {
    readonly id: string;
    readonly display_name: string;
    readonly capabilities: readonly source_capability[];
    private readonly options: rest_transport_options;
    private token: string | undefined;

    constructor(options: rest_transport_options) {
        super(options);
        this.options = options;
        this.id = options.id;
        this.display_name = options.display_name;
        this.capabilities = options.capabilities ?? ['list', 'fetch'];
    }

    protected async on_connect(): Promise<void> {
        if (!this.options.list_url) throw new connector_transport_error('invalid_config', `${this.id} requires list_url`, this.id);
        this.token = this.credential('token', this.options.token_env ?? []);
    }

    protected async list_items(query: source_query, context: source_context): Promise<source_page> {
        const url = new URL(this.options.list_url);
        if (query.cursor) url.searchParams.set(this.options.cursor_parameter ?? 'cursor', query.cursor);
        if (query.limit) url.searchParams.set(this.options.limit_parameter ?? 'limit', String(query.limit));
        if (query.search) url.searchParams.set(this.options.search_parameter ?? 'query', query.search);
        if (query.since) url.searchParams.set('since', query.since);
        const response = await this.request(url, { headers: this.headers() }, context);
        const payload = await response.json() as unknown;
        const values = at(payload, this.options.response_path);
        if (!Array.isArray(values)) throw new connector_transport_error('invalid_response', `${this.id} list response at ${this.options.response_path ?? '<root>'} is not an array`, this.id);
        const items = values.map((value, index) => this.map_item(value, index));
        return {
            items,
            next_cursor: string_at(payload, this.options.next_cursor_path) || null,
            total: Number(at(payload, this.options.total_path)) || null,
            metadata: { response_headers: Object.fromEntries(response.headers.entries()) },
        };
    }

    protected async fetch_item(item_id: string, context: source_context): Promise<source_document> {
        const template = this.options.item_url ?? this.options.list_url;
        const url = template.replace(/\{id\}/g, encodeURIComponent(item_id));
        const response = await this.request(url, { headers: this.headers() }, context);
        const mime_type = response.headers.get('content-type')?.split(';')[0] ?? null;
        if (mime_type?.includes('json')) {
            const payload = await response.json() as unknown;
            const item = this.map_item(payload, 0, item_id);
            const value = string_at(payload, this.options.fields?.text) || JSON.stringify(payload, null, 2);
            const data = Buffer.from(value);
            const extracted = extract_text(item.path ?? item.name, data, mime_type);
            return { item, text: extracted.text, data, analysis: extracted.analysis, metadata: { payload } };
        }
        const data = new Uint8Array(await response.arrayBuffer());
        const item = this.map_item({ id: item_id, name: item_id, uri: response.url }, 0, item_id);
        const extracted = extract_text(item.path ?? item.name, data, mime_type);
        return { item: { ...item, mime_type, size: data.length }, text: extracted.text, data, analysis: extracted.analysis, metadata: {} };
    }

    private map_item(value: unknown, index: number, fallback_id?: string): source_item {
        const fields = this.options.fields ?? {};
        const id = string_at(value, fields.id ?? 'id', fallback_id ?? String(index));
        const name = string_at(value, fields.name ?? 'name', id);
        const uri = string_at(value, fields.uri ?? 'url', this.options.item_url?.replace(/\{id\}/g, encodeURIComponent(id)) ?? id);
        const raw_kind = string_at(value, fields.kind) as source_item_kind;
        return {
            id,
            source: this.id,
            kind: raw_kind || this.options.default_kind || 'document',
            name,
            uri,
            path: string_at(value, fields.path) || null,
            mime_type: string_at(value, fields.mime_type) || null,
            size: Number(at(value, fields.size)) || null,
            created_at: string_at(value, fields.created_at) || null,
            updated_at: string_at(value, fields.updated_at) || null,
            etag: string_at(value, fields.etag) || null,
            metadata: value && typeof value === 'object' ? value as Record<string, unknown> : { value },
        };
    }

    private headers(): Record<string, string> {
        return {
            accept: 'application/json,text/plain;q=0.8,*/*;q=0.1',
            ...this.options.headers,
            ...(this.token ? { [this.options.auth_header ?? 'authorization']: `${this.options.auth_prefix ?? 'Bearer '}${this.token}` } : {}),
        };
    }
}