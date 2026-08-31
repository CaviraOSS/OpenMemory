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
 *  file  : src/core/memory/pattern_detector.ts
 *  usage : implements the LongMemory pattern detector component
 */


import type { GroundedFact } from '../grounding/exocortex.js';
import { clamp01, memory_utility } from '../math/utility.js';
import type { Contradiction } from '../types/contradiction.js';
import type { HydroNode } from '../types/hydro_node.js';

export type ConsolidationKind = 'semantic' | 'procedural' | 'reflection' | 'corrected_belief';

export type WorldCorrection = {
    fact: GroundedFact;
    source_memory_ids: string[];
};

export type ConsolidationSignals = {
    repetition: number;
    salience: number;
    grounding: number;
    utility: number;
    confidence: number;
    contradiction: number;
    noise: number;
    score: number;
};

export type ConsolidationPattern = {
    id: string;
    kind: ConsolidationKind;
    sources: HydroNode[];
    statement: string;
    signals: ConsolidationSignals;
    fact: GroundedFact | null;
};

export type PatternDetectionContext = {
    contradictions?: readonly Contradiction[];
    world_corrections?: readonly WorldCorrection[];
    min_repetitions?: number;
};

const token_re = /[a-z0-9]+/g;
const procedure_re = /\b(fail(?:ed|ure)?|error|mistake|retry|fix(?:ed)?|succeed(?:ed)?|worked|resolved|step|workflow)\b/i;
const stop = new Set(['i', 'we', 'the', 'a', 'an', 'my', 'our', 'again', 'today', 'yesterday', 'once']);
const outcome = new Set(['failed', 'failure', 'error', 'mistake', 'retry', 'fixed', 'succeeded', 'worked', 'resolved']);

const tokens = (text: string): string[] => text.toLowerCase().match(token_re) ?? [];

function pattern_key(node: HydroNode, procedural: boolean): string {
    const drop = procedural ? new Set([...stop, ...outcome]) : stop;
    const kept = tokens(node.content.canonical).filter((word) => !drop.has(word));
    return kept.join(' ');
}

function lexical_coherence(nodes: readonly HydroNode[]): number {
    if (nodes.length < 2) return 1;
    const sets = nodes.map((node) => new Set(tokens(node.content.canonical)));
    let total = 0;
    let pairs = 0;
    for (let left = 0; left < sets.length; left++) {
        for (let right = left + 1; right < sets.length; right++) {
            const union = new Set([...sets[left], ...sets[right]]);
            let overlap = 0;
            for (const word of sets[left]) if (sets[right].has(word)) overlap++;
            total += union.size === 0 ? 1 : overlap / union.size;
            pairs++;
        }
    }
    return pairs === 0 ? 1 : total / pairs;
}

function avg(nodes: readonly HydroNode[], value: (node: HydroNode) => number): number {
    if (nodes.length === 0) return 0;
    return nodes.reduce((sum, node) => sum + value(node), 0) / nodes.length;
}

export function consolidation_signals(
    nodes: readonly HydroNode[],
    contradictions: readonly Contradiction[] = [],
): ConsolidationSignals {
    const ids = new Set(nodes.map((node) => node.id));
    const related = contradictions.filter(
        (item) => !item.resolved && ids.has(item.node_a) && ids.has(item.node_b),
    );
    const repetition = clamp01(nodes.length / 3);
    const salience = avg(nodes, (node) => clamp01(node.state.salience));
    const grounding = avg(nodes, (node) => clamp01(node.grounding.grounding_score));
    const confidence = avg(nodes, (node) => clamp01(node.state.confidence));
    const contradiction = related.length === 0
        ? avg(nodes, (node) => (node.state.status === 'contradicted' ? 0.5 : 0))
        : related.reduce((sum, item) => sum + clamp01(item.pressure), 0) / related.length;
    const noise = clamp01(1 - lexical_coherence(nodes));
    const utility = memory_utility({
        recall_frequency: repetition,
        task_relevance: salience,
        grounding,
    });
    const score = repetition + salience + grounding + utility + confidence - contradiction - noise;
    return { repetition, salience, grounding, utility, confidence, contradiction, noise, score };
}

function best_statement(nodes: readonly HydroNode[]): string {
    return [...nodes]
        .sort((left, right) => right.temporal.observed_at - left.temporal.observed_at)[0]
        ?.content.summary ?? '';
}

function repeated_patterns(
    nodes: readonly HydroNode[],
    ctx: PatternDetectionContext,
): ConsolidationPattern[] {
    const min = Math.max(2, ctx.min_repetitions ?? 2);
    const groups = new Map<string, { kind: 'semantic' | 'procedural'; nodes: HydroNode[] }>();
    for (const node of nodes) {
        if (node.facets.episodic === null) continue;
        const kind = procedure_re.test(node.content.canonical) ? 'procedural' : 'semantic';
        const key = `${kind}:${pattern_key(node, kind === 'procedural')}`;
        const group = groups.get(key) ?? { kind, nodes: [] };
        group.nodes.push(node);
        groups.set(key, group);
    }

    const out: ConsolidationPattern[] = [];
    for (const [id, group] of groups) {
        if (group.nodes.length < min) continue;
        out.push({
            id,
            kind: group.kind,
            sources: group.nodes,
            statement: best_statement(group.nodes),
            signals: consolidation_signals(group.nodes, ctx.contradictions),
            fact: null,
        });
    }
    return out;
}

function reflection_patterns(
    nodes: readonly HydroNode[],
    contradictions: readonly Contradiction[],
): ConsolidationPattern[] {
    const by_id = new Map(nodes.map((node) => [node.id, node]));
    const pending = contradictions.filter((item) => !item.resolved);
    const seen = new Set<string>();
    const out: ConsolidationPattern[] = [];

    for (const start of pending) {
        if (seen.has(start.id)) continue;
        const member_ids = new Set<string>([start.node_a, start.node_b]);
        let changed = true;
        while (changed) {
            changed = false;
            for (const item of pending) {
                if (!member_ids.has(item.node_a) && !member_ids.has(item.node_b)) continue;
                seen.add(item.id);
                if (!member_ids.has(item.node_a)) { member_ids.add(item.node_a); changed = true; }
                if (!member_ids.has(item.node_b)) { member_ids.add(item.node_b); changed = true; }
            }
        }
        const sources = [...member_ids].map((id) => by_id.get(id)).filter((node): node is HydroNode => node !== undefined);
        if (sources.length < 2) continue;
        out.push({
            id: `reflection:${[...member_ids].sort().join(':')}`,
            kind: 'reflection',
            sources,
            statement: sources.map((node) => node.content.summary).join(' | '),
            signals: consolidation_signals(sources, pending),
            fact: null,
        });
    }
    return out;
}

function corrected_patterns(
    nodes: readonly HydroNode[],
    corrections: readonly WorldCorrection[],
): ConsolidationPattern[] {
    const by_id = new Map(nodes.map((node) => [node.id, node]));
    return corrections.flatMap((item) => {
        const sources = item.source_memory_ids
            .map((id) => by_id.get(id))
            .filter((node): node is HydroNode => node !== undefined);
        if (sources.length === 0) return [];
        const signals = consolidation_signals(sources);
        signals.repetition = 1;
        signals.grounding = item.fact.source.reliability;
        signals.utility = memory_utility({ recall_frequency: 1, task_relevance: signals.salience, grounding: signals.grounding });
        signals.score = signals.repetition + signals.salience + signals.grounding + signals.utility + signals.confidence - signals.contradiction - signals.noise;
        return [{
            id: `corrected:${item.fact.ref}`,
            kind: 'corrected_belief' as const,
            sources,
            statement: item.fact.statement,
            signals,
            fact: item.fact,
        }];
    });
}

export function detect_consolidation_patterns(
    nodes: readonly HydroNode[],
    ctx: PatternDetectionContext = {},
): ConsolidationPattern[] {
    const contradictions = ctx.contradictions ?? [];
    return [
        ...repeated_patterns(nodes, ctx),
        ...reflection_patterns(nodes, contradictions),
        ...corrected_patterns(nodes, ctx.world_corrections ?? []),
    ];
}