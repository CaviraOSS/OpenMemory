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
 *  file  : src/connectors/cloud/cloud_transports.ts
 *  usage : implements the LongMemory cloud transports component
 */

import { createHash } from 'node:crypto';
import { connector_transport, connector_transport_error, type connector_transport_options } from '../transports/base.js';
import type { source_context, source_document, source_item, source_page, source_query } from '../transports/types.js';
import { detect_content_type, extract_content } from '../extraction/content_extractor.js';

type json = Record<string, any>;

export type cloud_transport_options = connector_transport_options & {
    access_token?: string;
    page_size?: number;
    folder_id?: string;
    root_path?: string;
    notion_version?: string;
};

const encode = encodeURIComponent;
const checksum = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex');
const iso = (value: unknown) => typeof value === 'string' ? value : null;

abstract class oauth_transport extends connector_transport {
    protected token = '';
    constructor(protected readonly options: cloud_transport_options = {}) { super(options); }
    protected abstract token_env(): readonly string[];
    protected async on_connect(): Promise<void> {
        this.token = this.credential('access_token', this.token_env()) ?? this.options.access_token ?? '';
        if (!this.token) throw new connector_transport_error('missing_credentials', `${this.display_name} requires an access token`, this.id);
    }
    protected async json(url: string, init: RequestInit = {}, context: source_context = {}): Promise<json> {
        const response = await this.request(url, { ...init, headers: { authorization: `Bearer ${this.token}`, accept: 'application/json', ...(init.headers ?? {}) } }, context);
        return response.json() as Promise<json>;
    }
    protected async binary(url: string, context: source_context = {}): Promise<{ data: Uint8Array; content_type: string }> {
        const response = await this.request(url, { headers: { authorization: `Bearer ${this.token}` } }, context);
        return { data: new Uint8Array(await response.arrayBuffer()), content_type: response.headers.get('content-type') ?? '' };
    }
}

type google_mode = 'drive' | 'sheets' | 'slides';

export class google_workspace_transport extends oauth_transport {
    readonly id: string;
    readonly display_name: string;
    readonly capabilities = ['list', 'fetch', 'search', 'changes', 'files'] as const;
    private readonly mime: string | null;

    constructor(private readonly mode: google_mode, options: cloud_transport_options = {}) {
        super(options);
        this.id = mode === 'drive' ? 'google_drive' : mode === 'sheets' ? 'google_sheets' : 'google_slides';
        this.display_name = mode === 'drive' ? 'Google Drive' : mode === 'sheets' ? 'Google Sheets' : 'Google Slides';
        this.mime = mode === 'sheets' ? 'application/vnd.google-apps.spreadsheet' : mode === 'slides' ? 'application/vnd.google-apps.presentation' : null;
    }

    protected token_env() { return ['GOOGLE_ACCESS_TOKEN'] as const; }

    protected async list_items(query: source_query, context: source_context): Promise<source_page> {
        const items: source_item[] = [];
        const limit = query.limit ?? 1_000;
        let cursor: string | null = query.cursor ?? null;
        do {
            const clauses = ['trashed = false'];
            if (this.options.folder_id) clauses.push(`'${this.options.folder_id.replace(/'/g, "\\'")}' in parents`);
            if (this.mime) clauses.push(`mimeType = '${this.mime}'`);
            if (query.search) clauses.push(`name contains '${query.search.replace(/'/g, "\\'")}'`);
            const params = new URLSearchParams({ q: clauses.join(' and '), pageSize: String(Math.min(100, limit - items.length)), fields: 'nextPageToken,files(id,name,mimeType,size,createdTime,modifiedTime,md5Checksum,version,webViewLink,parents,owners)' });
            if (cursor) params.set('pageToken', cursor);
            const payload = await this.json(`https://www.googleapis.com/drive/v3/files?${params}`, {}, context);
            items.push(...(payload.files ?? []).map((file: json) => this.item(file)));
            cursor = payload.nextPageToken ?? null;
        } while (cursor && items.length < limit);
        return { items: items.slice(0, limit), next_cursor: cursor, total: null, metadata: { provider: this.id } };
    }

    protected async fetch_item(item_id: string, context: source_context): Promise<source_document> {
        const file = await this.json(`https://www.googleapis.com/drive/v3/files/${encode(item_id)}?fields=id,name,mimeType,size,createdTime,modifiedTime,md5Checksum,version,webViewLink,parents,owners`, {}, context);
        const item = this.item(file);
        if (this.mode === 'sheets') return this.fetch_sheet(item, context);
        if (this.mode === 'slides') return this.fetch_slides(item, context);
        const google_type = String(file.mimeType ?? '');
        let data: Uint8Array;
        let content_type: string;
        if (google_type === 'application/vnd.google-apps.document') {
            const exported = await this.binary(`https://www.googleapis.com/drive/v3/files/${encode(item_id)}/export?mimeType=text/markdown`, context);
            data = exported.data; content_type = 'markdown';
        } else if (google_type === 'application/vnd.google-apps.spreadsheet') {
            const exported = await this.binary(`https://www.googleapis.com/drive/v3/files/${encode(item_id)}/export?mimeType=text/csv`, context);
            data = exported.data; content_type = 'text';
        } else if (google_type === 'application/vnd.google-apps.presentation') {
            const exported = await this.binary(`https://www.googleapis.com/drive/v3/files/${encode(item_id)}/export?mimeType=text/plain`, context);
            data = exported.data; content_type = 'text';
        } else {
            const downloaded = await this.binary(`https://www.googleapis.com/drive/v3/files/${encode(item_id)}?alt=media`, context);
            data = downloaded.data; content_type = detect_content_type(item.name, downloaded.content_type || google_type);
        }
        const extracted = await extract_content({ data, content_type, filename: item.name, fetch: this.options.fetch });
        item.etag = file.md5Checksum ?? checksum(data);
        return { item, text: extracted.text, data, analysis: null, metadata: { ...extracted.metadata, provider: this.id, owners: file.owners ?? [], parents: file.parents ?? [] } };
    }

    private async fetch_sheet(item: source_item, context: source_context): Promise<source_document> {
        const payload = await this.json(`https://sheets.googleapis.com/v4/spreadsheets/${encode(item.id)}?includeGridData=true`, {}, context);
        const text = (payload.sheets ?? []).map((sheet: json) => {
            const title = sheet.properties?.title ?? 'Sheet';
            const rows = (sheet.data ?? []).flatMap((grid: json) => grid.rowData ?? []).map((row: json) => (row.values ?? []).map((cell: json) => cell.formattedValue ?? cell.userEnteredValue?.formulaValue ?? '').join('\t')).filter(Boolean);
            return `# ${title}\n\n${rows.join('\n')}`;
        }).join('\n\n');
        const data = Buffer.from(text);
        item.etag = checksum(data);
        return { item, text, data, analysis: null, metadata: { provider: this.id, spreadsheet_id: item.id, locale: payload.properties?.locale, time_zone: payload.properties?.timeZone, sheets: (payload.sheets ?? []).map((sheet: json) => sheet.properties) } };
    }

    private async fetch_slides(item: source_item, context: source_context): Promise<source_document> {
        const payload = await this.json(`https://slides.googleapis.com/v1/presentations/${encode(item.id)}`, {}, context);
        const slides = (payload.slides ?? []).map((slide: json, index: number) => {
            const values = (slide.pageElements ?? []).flatMap((element: json) => element.shape?.text?.textElements ?? []).map((element: json) => element.textRun?.content ?? '').join('').trim();
            return `# Slide ${index + 1}\n\n${values}`;
        });
        const text = `# ${payload.title ?? item.name}\n\n${slides.join('\n\n')}`;
        const data = Buffer.from(text);
        item.etag = checksum(data);
        return { item, text, data, analysis: null, metadata: { provider: this.id, presentation_id: item.id, slide_count: slides.length, page_size: payload.pageSize } };
    }

    private item(file: json): source_item {
        return { id: String(file.id), source: this.id, kind: 'document', name: String(file.name ?? file.id), uri: String(file.webViewLink ?? `https://drive.google.com/open?id=${file.id}`), path: null, mime_type: file.mimeType ?? null, size: file.size ? Number(file.size) : null, created_at: iso(file.createdTime), updated_at: iso(file.modifiedTime), etag: file.md5Checksum ?? file.version?.toString() ?? null, metadata: { mime_type: file.mimeType, parents: file.parents ?? [], owners: file.owners ?? [], version: file.version } };
    }
}

export class onedrive_transport extends oauth_transport {
    readonly id = 'onedrive';
    readonly display_name = 'OneDrive';
    readonly capabilities = ['list', 'fetch', 'search', 'changes', 'files'] as const;
    protected token_env() { return ['MICROSOFT_GRAPH_TOKEN', 'ONEDRIVE_ACCESS_TOKEN'] as const; }

    protected async list_items(query: source_query, context: source_context): Promise<source_page> {
        const items: source_item[] = [];
        let url: string | null = query.cursor ?? this.start_url(query.search);
        const limit = query.limit ?? 1_000;
        while (url && items.length < limit) {
            const payload = await this.json(url, {}, context);
            items.push(...(payload.value ?? []).filter((value: json) => value.file).map((value: json) => this.item(value)));
            url = payload['@odata.nextLink'] ?? null;
        }
        return { items: items.slice(0, limit), next_cursor: url, total: null, metadata: { provider: this.id } };
    }

    protected async fetch_item(item_id: string, context: source_context): Promise<source_document> {
        const item_payload = await this.json(`https://graph.microsoft.com/v1.0/me/drive/items/${encode(item_id)}`, {}, context);
        const item = this.item(item_payload);
        const downloaded = await this.binary(`https://graph.microsoft.com/v1.0/me/drive/items/${encode(item_id)}/content`, context);
        const content_type = detect_content_type(item.name, downloaded.content_type || String(item_payload.file?.mimeType ?? ''));
        const extracted = await extract_content({ data: downloaded.data, content_type, filename: item.name, fetch: this.options.fetch });
        item.etag = item_payload.eTag ?? checksum(downloaded.data);
        return { item, text: extracted.text, data: downloaded.data, analysis: null, metadata: { ...extracted.metadata, provider: this.id, parent_reference: item_payload.parentReference, hashes: item_payload.file?.hashes ?? {} } };
    }

    private start_url(search?: string): string {
        if (search) return `https://graph.microsoft.com/v1.0/me/drive/root/search(q='${encode(search)}')?$top=${this.options.page_size ?? 100}`;
        const root = this.options.root_path ? `/root:/${this.options.root_path.replace(/^\/+|\/+$/g, '')}:/children` : '/root/children';
        return `https://graph.microsoft.com/v1.0/me/drive${root}?$top=${this.options.page_size ?? 100}`;
    }

    private item(value: json): source_item {
        return { id: String(value.id), source: this.id, kind: 'file', name: String(value.name ?? value.id), uri: String(value.webUrl ?? ''), path: value.parentReference?.path ?? null, mime_type: value.file?.mimeType ?? null, size: typeof value.size === 'number' ? value.size : null, created_at: iso(value.createdDateTime), updated_at: iso(value.lastModifiedDateTime), etag: value.eTag ?? value.cTag ?? null, metadata: { parent_reference: value.parentReference, hashes: value.file?.hashes ?? {}, created_by: value.createdBy, modified_by: value.lastModifiedBy } };
    }
}

export class notion_transport extends oauth_transport {
    readonly id = 'notion';
    readonly display_name = 'Notion';
    readonly capabilities = ['list', 'fetch', 'search', 'changes'] as const;
    protected token_env() { return ['NOTION_API_KEY', 'NOTION_TOKEN'] as const; }

    protected async list_items(query: source_query, context: source_context): Promise<source_page> {
        const items: source_item[] = [];
        let cursor: string | null = query.cursor ?? null;
        const limit = query.limit ?? 1_000;
        do {
            const payload = await this.json('https://api.notion.com/v1/search', {
                method: 'POST', headers: this.headers(), body: JSON.stringify({ query: query.search, filter: { property: 'object', value: 'page' }, page_size: Math.min(100, limit - items.length), ...(cursor ? { start_cursor: cursor } : {}) }),
            }, context);
            items.push(...(payload.results ?? []).map((page: json) => this.item(page)));
            cursor = payload.has_more ? payload.next_cursor : null;
        } while (cursor && items.length < limit);
        return { items: items.slice(0, limit), next_cursor: cursor, total: null, metadata: { provider: this.id } };
    }

    protected async fetch_item(item_id: string, context: source_context): Promise<source_document> {
        const page = await this.json(`https://api.notion.com/v1/pages/${encode(item_id)}`, { headers: this.headers() }, context);
        const item = this.item(page);
        const lines = await this.blocks(item_id, context, 0);
        const text = `# ${item.name}\n\n${lines.join('\n\n')}`;
        const data = Buffer.from(text);
        item.etag = checksum(data);
        return { item, text, data, analysis: null, metadata: { provider: this.id, properties: page.properties ?? {}, parent: page.parent, icon: page.icon, cover: page.cover } };
    }

    private async blocks(block_id: string, context: source_context, depth: number): Promise<string[]> {
        if (depth > 4) return [];
        const lines: string[] = [];
        let cursor: string | null = null;
        do {
            const params = new URLSearchParams({ page_size: '100', ...(cursor ? { start_cursor: cursor } : {}) });
            const payload = await this.json(`https://api.notion.com/v1/blocks/${encode(block_id)}/children?${params}`, { headers: this.headers() }, context);
            for (const block of payload.results ?? []) {
                const value = block[block.type] ?? {};
                const text = this.rich_text(value.rich_text ?? value.caption ?? []);
                const prefix = block.type === 'heading_1' ? '# ' : block.type === 'heading_2' ? '## ' : block.type === 'heading_3' ? '### ' : block.type === 'bulleted_list_item' ? '- ' : block.type === 'numbered_list_item' ? '1. ' : block.type === 'to_do' ? `${value.checked ? '- [x] ' : '- [ ] '}` : block.type === 'quote' ? '> ' : '';
                if (text) lines.push(`${prefix}${text}`);
                if (block.has_children) lines.push(...await this.blocks(block.id, context, depth + 1));
            }
            cursor = payload.has_more ? payload.next_cursor : null;
        } while (cursor);
        return lines;
    }

    private item(page: json): source_item {
        const title_property = Object.values(page.properties ?? {}).find((property: any) => property?.type === 'title') as json | undefined;
        const name = this.rich_text(title_property?.title ?? []) || 'Untitled Notion page';
        return { id: String(page.id), source: this.id, kind: 'page', name, uri: String(page.url ?? ''), path: null, mime_type: 'text/markdown', size: null, created_at: iso(page.created_time), updated_at: iso(page.last_edited_time), etag: page.last_edited_time ?? null, metadata: { parent: page.parent, archived: page.archived, in_trash: page.in_trash, created_by: page.created_by, last_edited_by: page.last_edited_by } };
    }

    private rich_text(values: json[]): string { return values.map((value) => value.plain_text ?? value.text?.content ?? '').join(''); }
    private headers(): Record<string, string> { return { 'content-type': 'application/json', 'notion-version': this.options.notion_version ?? '2022-06-28' }; }
}