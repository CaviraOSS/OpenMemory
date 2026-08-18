import { lstat, readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { connector_transport, connector_transport_error, type connector_transport_options } from '../transports/base.js';
import type { source_context, source_document, source_item, source_page, source_query } from '../transports/types.js';
import { detect_content_type, extract_content } from './content_extractor.js';

export type document_transport_options = connector_transport_options & {
    root: string;
    include?: 'all' | 'pdf' | 'documents' | 'media';
    max_file_bytes?: number;
    openai_api_key?: string;
    openai_base_url?: string;
    transcription_model?: string;
    ffmpeg_path?: string;
};

const supported = new Set(['pdf', 'docx', 'html', 'markdown', 'text', 'audio', 'video']);

export class document_transport extends connector_transport {
    readonly id = 'document-files';
    readonly display_name = 'Document and media files';
    readonly capabilities = ['list', 'fetch', 'files'] as const;
    private readonly root: string;
    private readonly include: NonNullable<document_transport_options['include']>;
    private readonly max_file_bytes: number;

    constructor(private readonly options: document_transport_options) {
        super(options);
        this.root = resolve(options.root);
        this.include = options.include ?? 'all';
        this.max_file_bytes = options.max_file_bytes ?? 25 * 1024 * 1024;
    }

    protected async on_connect(): Promise<void> {
        const stat = await lstat(this.root);
        if (!stat.isDirectory()) throw new connector_transport_error('invalid_root', `document root is not a directory: ${this.root}`, this.id);
    }

    protected async list_items(query: source_query, context: source_context): Promise<source_page> {
        const items: source_item[] = [];
        const limit = Math.max(1, query.limit ?? 10_000);
        const walk = async (directory: string): Promise<void> => {
            context.signal?.throwIfAborted();
            for (const entry of (await readdir(directory, { withFileTypes: true })).sort((left, right) => left.name.localeCompare(right.name))) {
                if (items.length >= limit) return;
                const full = resolve(directory, entry.name);
                const path = relative(this.root, full).split(sep).join('/');
                if (entry.isDirectory()) { if (!/(^|\/)(\.git|node_modules|dist|build)(\/|$)/.test(path)) await walk(full); continue; }
                if (!entry.isFile()) continue;
                const stat = await lstat(full);
                const type = detect_content_type(entry.name);
                if (!supported.has(type) || stat.size > this.max_file_bytes || !this.matches(type)) continue;
                if (query.search && !path.toLowerCase().includes(query.search.toLowerCase())) continue;
                items.push({ id: path, source: this.id, kind: 'file', name: entry.name, uri: pathToFileURL(full).href, path, mime_type: type, size: stat.size, created_at: stat.birthtime.toISOString(), updated_at: stat.mtime.toISOString(), etag: `${stat.size}:${stat.mtimeMs}`, metadata: { content_type: type } });
            }
        };
        await walk(this.root);
        return { items, next_cursor: null, total: items.length, metadata: { root: this.root, include: this.include } };
    }

    protected async fetch_item(item_id: string): Promise<source_document> {
        const path = this.safe_path(item_id);
        const stat = await lstat(path);
        if (!stat.isFile() || stat.size > this.max_file_bytes) throw new connector_transport_error('invalid_file', `document file is unavailable or too large: ${item_id}`, this.id);
        const data = await readFile(path);
        const content_type = detect_content_type(item_id);
        const extracted = await extract_content({ data, content_type, filename: basename(path), openai_api_key: this.options.openai_api_key, openai_base_url: this.options.openai_base_url, transcription_model: this.options.transcription_model, ffmpeg_path: this.options.ffmpeg_path, fetch: this.options.fetch });
        const checksum = createHash('sha256').update(data).digest('hex');
        const item: source_item = { id: item_id, source: this.id, kind: 'file', name: basename(path), uri: pathToFileURL(path).href, path: item_id, mime_type: content_type, size: stat.size, created_at: stat.birthtime.toISOString(), updated_at: stat.mtime.toISOString(), etag: checksum, metadata: { content_type } };
        return { item, text: extracted.text, data, analysis: null, metadata: { ...extracted.metadata, absolute_path: path, checksum } };
    }

    private matches(type: string): boolean {
        if (this.include === 'all') return true;
        if (this.include === 'pdf') return type === 'pdf';
        if (this.include === 'media') return type === 'audio' || type === 'video';
        return !['audio', 'video'].includes(type);
    }

    private safe_path(path: string): string {
        const target = resolve(this.root, path);
        if (target !== this.root && !target.startsWith(`${this.root}${sep}`)) throw new connector_transport_error('path_escape', `path escapes document root: ${path}`, this.id);
        return target;
    }
}