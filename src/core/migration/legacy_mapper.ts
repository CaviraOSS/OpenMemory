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
 *  file  : src/core/migration/legacy_mapper.ts
 *  usage : map useful legacy memory into the Hydrograph engine
 */

import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { create_memory } from '../create_memory.js';
import { create_hydro_edge } from '../memory/durable_graph.js';
import { manual_provenance } from '../types/provenance.js';
import { SqliteStore } from '../../stores/sqlite/sqlite_store.js';
import { clean_legacy_data } from './legacy_cleaner.js';
import { read_legacy_source } from './legacy_reader.js';
import type { migration_benchmark_result, migration_report } from './migration_report.js';

export type legacy_migration_options = {
    from: string;
    to: string;
    overwrite?: boolean;
};

const supported_relations = new Set(['contains', 'refers_to', 'same_as', 'supports', 'contradicts', 'supersedes', 'derived_from', 'grounds', 'semantic_shift']);

const relation_type = (value: string) => {
    const aliases: Record<string, string> = {
        duplicate: 'same_as',
        equivalent: 'same_as',
        contradict: 'contradicts',
        contradiction: 'contradicts',
        supersede: 'supersedes',
        replaced_by: 'supersedes',
        related: 'refers_to',
        relates_to: 'refers_to',
        waypoint: 'refers_to',
    };
    const mapped = aliases[value] ?? value;
    return supported_relations.has(mapped) ? mapped : 'refers_to';
};

async function benchmark_migration(path: string, imported_node_ids: string[]): Promise<migration_benchmark_result> {
    const store = new SqliteStore(path, { startup_integrity_check: true });
    const integrity = store.check_integrity();
    store.close();
    const memory = create_memory({ store: 'sqlite', db_path: path });
    try {
        const stats = await memory.getStats();
        const hydration = imported_node_ids.length === 0 || (await memory.explain(imported_node_ids[0])).node !== null;
        const checks = [
            { name: 'sqlite_integrity', passed: integrity.ok, detail: `${integrity.issues.length} integrity issues` },
            { name: 'node_hydration', passed: hydration, detail: hydration ? 'first imported node hydrated' : 'first imported node missing' },
            { name: 'node_count', passed: stats.nodes >= imported_node_ids.length, detail: `${stats.nodes} stored nodes` },
        ];
        return { passed: checks.every((check) => check.passed), checks };
    } finally {
        await memory.close();
    }
}

async function copy_hydrograph(from: string, to: string, started_at: number): Promise<migration_report> {
    const source = new Database(from, { readonly: true, fileMustExist: true });
    try { await source.backup(to); } finally { source.close(); }
    const memory = create_memory({ store: 'sqlite', db_path: to });
    const stats = await memory.getStats();
    await memory.close();
    const store = new SqliteStore(to);
    const node_ids = store.load_nodes().map((node) => node.id);
    const edge_ids = store.load_edges().map((edge) => edge.id);
    const world_ids = store.load_worlds().map((world) => world.id);
    const entity_ids = store.load_entities().map((entity) => entity.id);
    store.close();
    return {
        source_path: from,
        destination_path: to,
        source_format: 'hydrograph',
        started_at,
        completed_at: Date.now(),
        imported_nodes: stats.nodes,
        imported_node_ids: node_ids,
        imported_edges: stats.edges,
        imported_edge_ids: edge_ids,
        created_worlds: stats.worlds,
        created_world_ids: world_ids,
        created_entities: stats.entities,
        created_entity_ids: entity_ids,
        detected_duplicates: [],
        contradictions_found: 0,
        skipped_records: [],
        errors: [],
        benchmark_result: await benchmark_migration(to, node_ids),
    };
}

export async function migrate_legacy(options: legacy_migration_options): Promise<migration_report> {
    const started_at = Date.now();
    const from = resolve(options.from);
    const to = resolve(options.to);
    if (from === to) throw new Error('migration source and destination must differ');
    if (!existsSync(from)) throw new Error(`migration source not found: ${from}`);
    if (existsSync(to) && !options.overwrite) throw new Error(`migration destination already exists: ${to}`);
    mkdirSync(dirname(to), { recursive: true });
    const read = read_legacy_source(from);
    if (read.format === 'hydrograph') return copy_hydrograph(from, to, started_at);
    const clean = clean_legacy_data(read);
    const imported_node_ids = new Set<string>();
    const imported_edge_ids = new Set<string>();
    const world_ids = new Set<string>();
    const entity_ids = new Set<string>();
    const node_by_source = new Map<string, string>();
    const skipped = [...clean.skipped];
    const errors = [...clean.errors];
    let contradictions_found = 0;
    const memory = create_memory({ store: 'sqlite', db_path: to, enable_consolidation: true });
    try {
        for (const item of clean.records) {
            try {
                const result = await memory.ingest({
                    id: `legacy:${item.source_id}`,
                    user_id: item.user_id,
                    text: item.text,
                    at: item.at,
                    observed_at: item.observed_at,
                    valid_from: item.valid_from,
                    valid_to: item.valid_to,
                    world: item.world,
                    tags: item.tags,
                    facet_hint: item.facet,
                    external: item.source !== null,
                    source: item.source ?? undefined,
                    contract: item.source ? undefined : { requires_grounding: false, source_required: false },
                    metadata: item.metadata,
                });
                node_by_source.set(item.source_id, result.node.id);
                result.diff.created_node_ids.forEach((id) => imported_node_ids.add(id));
                result.diff.created_edge_ids.forEach((id) => imported_edge_ids.add(id));
                result.diff.world_ids.forEach((id) => world_ids.add(id));
                result.diff.resolved_entities.forEach((entity) => entity_ids.add(entity.id));
                contradictions_found += result.edges.filter((edge) => edge.type === 'contradicts').length;
            } catch (error) {
                const detail = error instanceof Error ? error.message : String(error);
                skipped.push({ record_id: item.source_id, reason: 'ingest_failed', detail });
                errors.push(`${item.source_id}: ${detail}`);
            }
        }
    } finally {
        await memory.close();
    }
    for (const duplicate of clean.duplicates) {
        const canonical = node_by_source.get(duplicate.canonical_id);
        if (canonical) node_by_source.set(duplicate.duplicate_id, canonical);
    }
    const store = new SqliteStore(to, { startup_integrity_check: false });
    try {
        for (const relation of clean.relations) {
            const from_id = node_by_source.get(clean.canonical_ids.get(relation.from) ?? relation.from);
            const to_id = node_by_source.get(clean.canonical_ids.get(relation.to) ?? relation.to);
            if (!from_id || !to_id || from_id === to_id) {
                errors.push(`relation ${relation.source_id} skipped: endpoints were missing or deduplicated`);
                continue;
            }
            const type = relation_type(relation.type);
            try {
                const edge = create_hydro_edge({
                    from: from_id,
                    to: to_id,
                    type,
                    confidence: 0.8,
                    weight: relation.weight,
                    temporal: { valid_from: relation.at, valid_to: null, observed_at: relation.at, recorded_at: relation.at },
                    handler: { handler: type, params: { legacy_relation_id: relation.source_id } },
                    provenance: manual_provenance('legacy-migration', relation.at),
                });
                store.execute_edge_transaction(edge);
                imported_edge_ids.add(edge.id);
                if (type === 'contradicts') contradictions_found++;
            } catch (error) {
                errors.push(`relation ${relation.source_id}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    } finally {
        store.close();
    }
    const report: migration_report = {
        source_path: from,
        destination_path: to,
        source_format: read.format,
        started_at,
        completed_at: Date.now(),
        imported_nodes: imported_node_ids.size,
        imported_node_ids: [...imported_node_ids],
        imported_edges: imported_edge_ids.size,
        imported_edge_ids: [...imported_edge_ids],
        created_worlds: world_ids.size,
        created_world_ids: [...world_ids],
        created_entities: entity_ids.size,
        created_entity_ids: [...entity_ids],
        detected_duplicates: clean.duplicates,
        contradictions_found,
        skipped_records: skipped,
        errors,
        benchmark_result: await benchmark_migration(to, [...imported_node_ids]),
    };
    return report;
}