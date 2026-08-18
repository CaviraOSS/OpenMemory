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
 *  file  : src/core/migration/legacy_reader.ts
 *  usage : read legacy SQLite, JSON, and JSONL memory exports
 */

import { readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import Database from 'better-sqlite3';

export type legacy_source_format = 'sqlite' | 'json' | 'jsonl' | 'hydrograph';

export type legacy_read_issue = {
    record_id: string | null;
    reason: string;
    detail?: string;
};

export type legacy_read_result = {
    source_path: string;
    format: legacy_source_format;
    records: unknown[];
    relations: unknown[];
    skipped: legacy_read_issue[];
    errors: string[];
};

const rows = (database: Database.Database, table: string): unknown[] => database.prepare(`SELECT * FROM "${table}"`).all();

function read_sqlite(source_path: string): legacy_read_result {
    const database = new Database(source_path, { readonly: true, fileMustExist: true });
    try {
        const names = new Set((database.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>).map((item) => item.name));
        if (names.has('hydro_nodes')) {
            return { source_path, format: 'hydrograph', records: [], relations: [], skipped: [], errors: [] };
        }
        const memory_table = ['memories', 'memory', 'records'].find((name) => names.has(name));
        if (!memory_table) {
            return {
                source_path,
                format: 'sqlite',
                records: [],
                relations: [],
                skipped: [],
                errors: ['legacy SQLite source has no memories, memory, or records table'],
            };
        }
        const relation_table = ['waypoints', 'relations', 'edges'].find((name) => names.has(name));
        return {
            source_path,
            format: 'sqlite',
            records: rows(database, memory_table),
            relations: relation_table ? rows(database, relation_table) : [],
            skipped: [],
            errors: [],
        };
    } finally {
        database.close();
    }
}

function unpack_json(value: unknown): { records: unknown[]; relations: unknown[] } {
    if (Array.isArray(value)) return { records: value, relations: [] };
    if (!value || typeof value !== 'object') return { records: [value], relations: [] };
    const root = value as Record<string, unknown>;
    const records = root.memories ?? root.records ?? root.data ?? [root];
    const relations = root.waypoints ?? root.relations ?? root.edges ?? [];
    return {
        records: Array.isArray(records) ? records : [records],
        relations: Array.isArray(relations) ? relations : [relations],
    };
}

function read_jsonl(source_path: string, text: string): legacy_read_result {
    const records: unknown[] = [];
    const skipped: legacy_read_issue[] = [];
    for (const [index, line] of text.split(/\r?\n/).entries()) {
        if (!line.trim()) continue;
        try {
            records.push(JSON.parse(line) as unknown);
        } catch (error) {
            skipped.push({
                record_id: `line:${index + 1}`,
                reason: 'invalid_json',
                detail: error instanceof Error ? error.message : String(error),
            });
        }
    }
    return { source_path, format: 'jsonl', records, relations: [], skipped, errors: [] };
}

export function read_legacy_source(path: string): legacy_read_result {
    const source_path = resolve(path);
    const prefix = readFileSync(source_path).subarray(0, 16).toString('utf8');
    if (prefix === 'SQLite format 3\0') return read_sqlite(source_path);
    const text = readFileSync(source_path, 'utf8');
    if (extname(source_path).toLowerCase() === '.jsonl') return read_jsonl(source_path, text);
    try {
        const unpacked = unpack_json(JSON.parse(text) as unknown);
        return { source_path, format: 'json', ...unpacked, skipped: [], errors: [] };
    } catch {
        return read_jsonl(source_path, text);
    }
}