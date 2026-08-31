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
 *  file  : src/core/project/project_code_index.ts
 *  usage : implements the LongMemory project code index component
 */


import type { HydroNode } from '../types/hydro_node.js';
import type { source_symbol } from '../../connectors/transports/types.js';

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

export type project_code_symbol = source_symbol & {
    id: string;
    memory_id: string;
    file_path: string;
    commit: string | null;
    language: string;
};

export type project_code_relation = {
    caller: project_code_symbol;
    callee: project_code_symbol;
};

export type project_code_impact = {
    symbol: project_code_symbol;
    depth: number;
    via: string | null;
};

const analysis_of = (node: HydroNode): { language?: string; symbols?: source_symbol[] } => {
    const value = node.metadata.analysis;
    return value && typeof value === 'object' ? value as { language?: string; symbols?: source_symbol[] } : {};
};

export function code_symbols_from_nodes(nodes: HydroNode[]): project_code_symbol[] {
    return nodes.flatMap((node) => {
        const analysis = analysis_of(node);
        const file_path = string_or_null(node.metadata.file_path ?? node.metadata.path ?? (node.metadata.source_item as Record<string, unknown> | undefined)?.path);
        if (!file_path || !Array.isArray(analysis.symbols)) return [];
        return analysis.symbols.flatMap((symbol) => {
            if (!symbol || typeof symbol.name !== 'string' || typeof symbol.line !== 'number') return [];
            const calls = Array.isArray(symbol.calls) ? symbol.calls.filter((value): value is string => typeof value === 'string') : [];
            return [{
                ...symbol, end_line: typeof symbol.end_line === 'number' ? symbol.end_line : symbol.line, calls,
                id: `${node.id}#${symbol.name}:${symbol.line}`, memory_id: node.id, file_path,
                commit: string_or_null(node.metadata.commit ?? (node.metadata.citation as Record<string, unknown> | undefined)?.commit),
                language: typeof analysis.language === 'string' ? analysis.language : 'Unknown',
            }];
        });
    }).sort((left, right) => left.file_path.localeCompare(right.file_path) || left.line - right.line || left.name.localeCompare(right.name));
}

export function code_call_relations(symbols: project_code_symbol[]): project_code_relation[] {
    const by_name = new Map<string, project_code_symbol[]>();
    for (const symbol of symbols) by_name.set(symbol.name, [...(by_name.get(symbol.name) ?? []), symbol]);
    return symbols.flatMap((caller) => caller.calls.flatMap((name) => (by_name.get(name) ?? []).map((callee) => ({ caller, callee }))))
        .filter((relation, index, values) => values.findIndex((value) => value.caller.id === relation.caller.id && value.callee.id === relation.callee.id) === index);
}

export function search_code_symbols(symbols: project_code_symbol[], query: string, limit = 20): project_code_symbol[] {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return [];
    return symbols.filter((symbol) => `${symbol.name} ${symbol.signature} ${symbol.file_path}`.toLocaleLowerCase().includes(normalized))
        .sort((left, right) => Number(right.name.toLocaleLowerCase() === normalized) - Number(left.name.toLocaleLowerCase() === normalized) || left.name.length - right.name.length)
        .slice(0, limit);
}

export function code_callers(symbols: project_code_symbol[], name: string): project_code_relation[] {
    const normalized = name.toLocaleLowerCase();
    return code_call_relations(symbols).filter((relation) => relation.callee.name.toLocaleLowerCase() === normalized);
}

export function code_callees(symbols: project_code_symbol[], name: string): project_code_relation[] {
    const normalized = name.toLocaleLowerCase();
    return code_call_relations(symbols).filter((relation) => relation.caller.name.toLocaleLowerCase() === normalized);
}

export function code_impact(symbols: project_code_symbol[], name: string, max_depth = 5): project_code_impact[] {
    const relations = code_call_relations(symbols);
    const start = symbols.filter((symbol) => symbol.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    const found = new Map<string, project_code_impact>(start.map((symbol) => [symbol.id, { symbol, depth: 0, via: null }]));
    let frontier = start;
    for (let depth = 1; depth <= max_depth && frontier.length; depth++) {
        const ids = new Set(frontier.map((symbol) => symbol.id));
        const next: project_code_symbol[] = [];
        for (const relation of relations) {
            if (!ids.has(relation.callee.id) || found.has(relation.caller.id)) continue;
            found.set(relation.caller.id, { symbol: relation.caller, depth, via: relation.callee.name });
            next.push(relation.caller);
        }
        frontier = next;
    }
    return [...found.values()].sort((left, right) => left.depth - right.depth || left.symbol.file_path.localeCompare(right.symbol.file_path));
}