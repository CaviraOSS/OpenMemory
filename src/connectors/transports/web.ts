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
 *  file  : src/connectors/transports/web.ts
 *  usage : web page, RSS/Atom, and sitemap connector transports
 */

import { connector_transport, type connector_transport_options } from './base.js';
import { extract_text } from './extractors/file_analysis.js';
import type { source_capability, source_context, source_document, source_item, source_page, source_query } from './types.js';

const decode = (value: string) => value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
const tag = (xml: string, name: string) => decode(xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1] ?? '');

export type web_transport_options = connector_transport_options & { urls: string[]; id?: string; display_name?: string; headers?: Record<string, string> };

export class web_transport extends connector_transport {
    readonly id: string;
    readonly display_name: string;
    readonly capabilities: readonly source_capability[] = ['list', 'fetch'];
    protected readonly urls: string[];
    protected readonly headers: Record<string, string>;

    constructor(options: web_transport_options) {
        super(options);
        this.id = options.id ?? 'web';
        this.display_name = options.display_name ?? 'Web';
        this.urls = [...new Set(options.urls.map((url) => new URL(url).href))];
        this.headers = options.headers ?? {};
    }

    protected async list_items(query: source_query, _context: source_context): Promise<source_page> {
        const filtered = this.urls.filter((url) => !query.search || url.toLowerCase().includes(query.search.toLowerCase())).slice(0, query.limit ?? this.urls.length);
        const items = filtered.map((url) => this.item(url));
        return { items, next_cursor: null, total: items.length, metadata: {} };
    }

    protected async fetch_item(item_id: string, context: source_context): Promise<source_document> {
        const url = new URL(item_id).href;
        const response = await this.request(url, { headers: { accept: 'text/html,text/plain,application/json,application/xml;q=0.9,*/*;q=0.1', ...this.headers } }, context);
        const data = new Uint8Array(await response.arrayBuffer());
        const mime_type = response.headers.get('content-type')?.split(';')[0] ?? null;
        const extracted = extract_text(new URL(url).pathname || 'index.html', data, mime_type);
        return {
            item: { ...this.item(url), mime_type, size: data.length, etag: response.headers.get('etag'), updated_at: response.headers.get('last-modified') },
            text: extracted.text,
            data,
            analysis: extracted.analysis,
            metadata: { status: response.status, final_url: response.url },
        };
    }

    protected item(url: string): source_item {
        const parsed = new URL(url);
        return { id: url, source: this.id, kind: 'page', name: parsed.pathname.split('/').filter(Boolean).pop() ?? parsed.hostname, uri: url, path: parsed.pathname, mime_type: null, size: null, created_at: null, updated_at: null, etag: null, metadata: { host: parsed.hostname } };
    }
}

export class sitemap_transport extends web_transport {
    readonly capabilities: readonly source_capability[] = ['list', 'fetch', 'search'];

    constructor(options: Omit<web_transport_options, 'urls'> & { sitemap_url: string }) {
        super({ ...options, id: options.id ?? 'sitemap', display_name: options.display_name ?? 'Sitemap', urls: [options.sitemap_url] });
    }

    protected async list_items(query: source_query, context: source_context): Promise<source_page> {
        const response = await this.request(this.urls[0], { headers: this.headers }, context);
        const xml = await response.text();
        const urls = [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].map((match) => decode(match[1]));
        const filtered = urls.filter((url) => !query.search || url.toLowerCase().includes(query.search.toLowerCase())).slice(0, query.limit ?? urls.length);
        return { items: filtered.map((url) => this.item(url)), next_cursor: null, total: urls.length, metadata: { sitemap_url: this.urls[0] } };
    }
}

export class rss_transport extends web_transport {
    readonly capabilities: readonly source_capability[] = ['list', 'fetch', 'changes'];

    constructor(options: Omit<web_transport_options, 'urls'> & { feed_url: string }) {
        super({ ...options, id: options.id ?? 'rss', display_name: options.display_name ?? 'RSS / Atom', urls: [options.feed_url] });
    }

    protected async list_items(query: source_query, context: source_context): Promise<source_page> {
        const response = await this.request(this.urls[0], { headers: { accept: 'application/rss+xml,application/atom+xml,application/xml,text/xml', ...this.headers } }, context);
        const xml = await response.text();
        const entries = [...xml.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)].map((match) => match[2]);
        const items = entries.map((entry, index): source_item => {
            const link = tag(entry, 'link') || entry.match(/<link[^>]+href=["']([^"']+)/i)?.[1] || tag(entry, 'guid') || `${this.urls[0]}#${index}`;
            const title = tag(entry, 'title') || link;
            return { id: link, source: this.id, kind: 'feed_entry', name: title, uri: link, path: null, mime_type: 'text/html', size: null, created_at: tag(entry, 'published') || tag(entry, 'pubDate') || null, updated_at: tag(entry, 'updated') || null, etag: tag(entry, 'guid') || null, metadata: { summary: tag(entry, 'description') || tag(entry, 'summary'), feed_url: this.urls[0] } };
        }).filter((item) => !query.search || `${item.name} ${item.metadata.summary}`.toLowerCase().includes(query.search.toLowerCase())).slice(0, query.limit ?? entries.length);
        return { items, next_cursor: null, total: entries.length, metadata: { feed_url: this.urls[0], title: tag(xml, 'title') } };
    }
}