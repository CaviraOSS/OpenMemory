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
 *  file  : src/core/migration/migration_report.ts
 *  usage : serializable legacy migration audit report
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { legacy_duplicate } from './legacy_cleaner.js';
import type { legacy_read_issue, legacy_source_format } from './legacy_reader.js';

export type migration_benchmark_result = {
    passed: boolean;
    checks: Array<{ name: string; passed: boolean; detail: string }>;
};

export type migration_report = {
    source_path: string;
    destination_path: string;
    source_format: legacy_source_format;
    started_at: number;
    completed_at: number;
    imported_nodes: number;
    imported_node_ids: string[];
    imported_edges: number;
    imported_edge_ids: string[];
    created_worlds: number;
    created_world_ids: string[];
    created_entities: number;
    created_entity_ids: string[];
    detected_duplicates: legacy_duplicate[];
    contradictions_found: number;
    skipped_records: legacy_read_issue[];
    errors: string[];
    benchmark_result: migration_benchmark_result;
};

export function write_migration_report(report: migration_report, path: string): string {
    const output = resolve(path);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    return output;
}