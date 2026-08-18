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
 *  file  : src/core/project/project_code_index.ts
 *  usage : project code facts and source snapshot freshness
 */

import type { HydroNode } from '../types/hydro_node.js';

export type project_code_fact = {
    memory_id: string;
    text: string;
    repo: string | null;
    branch: string | null;
    commit: string | null;
    file_path: string | null;
    line_start: number | null;
    line_end: number | null;
    checksum: string | null;
    current_ref: string | null;
    stale: boolean;
    freshness_score: number;
};

const string_or_null = (value: unknown) => typeof value === 'string' && value ? value : null;

export function code_fact_from_node(node: HydroNode, current_ref: string | null = null): project_code_fact {
    const commit = string_or_null(node.metadata.commit ?? (node.metadata.citation as Record<string, unknown> | undefined)?.commit);
    const stale = Boolean(current_ref && commit && current_ref !== commit);
    return {
        memory_id: node.id,
        text: node.content.raw,
        repo: string_or_null(node.metadata.repo ?? node.metadata.repository),
        branch: string_or_null(node.metadata.branch),
        commit,
        file_path: string_or_null(node.metadata.file_path ?? node.metadata.path ?? (node.metadata.citation as Record<string, unknown> | undefined)?.path),
        line_start: typeof node.metadata.line_start === 'number' ? node.metadata.line_start : null,
        line_end: typeof node.metadata.line_end === 'number' ? node.metadata.line_end : null,
        checksum: string_or_null(node.metadata.checksum),
        current_ref,
        stale,
        freshness_score: stale ? 0.2 : 1,
    };
}

export function rank_code_facts(facts: project_code_fact[]): project_code_fact[] {
    return [...facts].sort((left, right) => right.freshness_score - left.freshness_score || left.file_path?.localeCompare(right.file_path ?? '') || 0);
}