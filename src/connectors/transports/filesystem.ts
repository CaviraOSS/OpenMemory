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
 *  file  : src/connectors/transports/filesystem.ts
 *  usage : implements the LongMemory filesystem component
 */

import { lstat, readFile, readdir } from 'node:fs/promises';
import { basename, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { connector_transport, type connector_transport_options, connector_transport_error } from './base.js';
import { extract_text } from './extractors/file_analysis.js';
import type { source_context, source_document, source_item, source_page, source_query } from './types.js';

export type filesystem_transport_options = connector_transport_options & {
    root: string;
    ignore?: RegExp[];
    max_file_bytes?: number;
    follow_symlinks?: boolean;
};

export class filesystem_transport extends connector_transport {
    readonly id = 'filesystem';
    readonly display_name = 'Local filesystem';
    readonly capabilities = ['list', 'fetch', 'search', 'files'] as const;
    private readonly root: string;
    private readonly ignore: RegExp[];
    private readonly max_file_bytes: number;
    private readonly follow_symlinks: boolean;

    constructor(options: filesystem_transport_options) {
        super(options);
        this.root = resolve(options.root);
        this.ignore = options.ignore ?? [/(^|\/)(\.git|node_modules|dist|build|coverage)(\/|$)/];
        this.max_file_bytes = options.max_file_bytes ?? 10 * 1024 * 1024;
        this.follow_symlinks = options.follow_symlinks ?? false;
    }

    protected async on_connect(): Promise<void> {
        const stat = await lstat(this.root);
        if (!stat.isDirectory()) throw new connector_transport_error('invalid_root', `filesystem root is not a directory: ${this.root}`, this.id);
    }

    protected async list_items(query: source_query, context: source_context): Promise<source_page> {
        const items: source_item[] = [];
        const limit = Math.max(1, query.limit ?? 10_000);
        const start = query.path ? this.safe_path(query.path) : this.root;
        const walk = async (directory: string): Promise<void> => {
            if (items.length >= limit) return;
            context.signal?.throwIfAborted();
            const entries = await readdir(directory, { withFileTypes: true });
            for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
                const full = resolve(directory, entry.name);
                const path = relative(this.root, full).split(sep).join('/');
                if (this.ignore.some((pattern) => pattern.test(path))) continue;
                if (entry.isSymbolicLink() && !this.follow_symlinks) continue;
                if (entry.isDirectory()) {
                    await walk(full);
                    continue;
                }
                if (!entry.isFile() || items.length >= limit) continue;
                const stat = await lstat(full);
                if (stat.size > this.max_file_bytes) continue;
                if (query.search && !path.toLowerCase().includes(query.search.toLowerCase())) continue;
                items.push({
                    id: path,
                    source: this.id,
                    kind: 'file',
                    name: entry.name,
                    uri: pathToFileURL(full).href,
                    path,
                    mime_type: null,
                    size: stat.size,
                    created_at: stat.birthtime.toISOString(),
                    updated_at: stat.mtime.toISOString(),
                    etag: `${stat.size}:${stat.mtimeMs}`,
                    metadata: { mode: stat.mode, inode: stat.ino },
                });
            }
        };
        await walk(start);
        return { items, next_cursor: null, total: items.length, metadata: { root: this.root } };
    }

    protected async fetch_item(item_id: string): Promise<source_document> {
        const path = this.safe_path(item_id);
        const stat = await lstat(path);
        if (!stat.isFile()) throw new connector_transport_error('not_file', `not a file: ${item_id}`, this.id);
        if (stat.size > this.max_file_bytes) throw new connector_transport_error('file_too_large', `file exceeds ${this.max_file_bytes} bytes: ${item_id}`, this.id);
        const data = await readFile(path);
        const extracted = extract_text(item_id, data);
        const item: source_item = {
            id: item_id,
            source: this.id,
            kind: 'file',
            name: basename(path),
            uri: pathToFileURL(path).href,
            path: item_id,
            mime_type: null,
            size: stat.size,
            created_at: stat.birthtime.toISOString(),
            updated_at: stat.mtime.toISOString(),
            etag: `${stat.size}:${stat.mtimeMs}`,
            metadata: { mode: stat.mode, inode: stat.ino },
        };
        return { item, text: extracted.text, data, analysis: extracted.analysis, metadata: { absolute_path: path } };
    }

    private safe_path(path: string): string {
        const target = resolve(this.root, path);
        const prefix = `${this.root}${sep}`;
        if (target !== this.root && !target.startsWith(prefix)) throw new connector_transport_error('path_escape', `path escapes source root: ${path}`, this.id);
        return target;
    }
}