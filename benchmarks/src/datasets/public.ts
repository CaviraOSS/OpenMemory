import { readFileSync } from "node:fs";
import type { benchmark_case, benchmark_event, dataset_load } from "../types";

const day_ms = 86_400_000;
const base_time = Date.UTC(2024, 0, 1);

type longmem_turn = { role?: string; content?: string; has_answer?: boolean };
type longmem_entry = {
    question_id: string;
    question_type: string;
    question: string;
    answer: unknown;
    question_date?: string;
    haystack_session_ids: string[];
    haystack_dates: string[];
    haystack_sessions: longmem_turn[][];
    answer_session_ids?: string[];
};

type locomo_turn = { speaker?: string; dia_id?: string; text?: string; blip_caption?: string };
type locomo_qa = { question?: string; answer?: unknown; category?: number; evidence?: string[] };
type locomo_entry = { sample_id: string; conversation: Record<string, unknown>; qa?: locomo_qa[] };

const timestamp = (value: string | undefined, fallback: number): number => {
    if (!value) return fallback;
    const normalized = value
        .replace(/\s*\([A-Za-z]{3}\)\s*/, " ")
        .replace(/^(\d{1,2}):(\d{2})\s*(am|pm)\s+on\s+(\d{1,2})\s+([A-Za-z]+),\s*(\d{4})$/i, "$5 $4, $6 $1:$2 $3");
    const parsed = Date.parse(normalized);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const longmem_category = (entry: longmem_entry): string => {
    if (entry.question_id.endsWith("_abs")) return "abstention";
    return ({
        "single-session-user": "information-extraction",
        "single-session-assistant": "information-extraction",
        "single-session-preference": "preference",
        "multi-session": "multi-session",
        "temporal-reasoning": "temporal-reasoning",
        "knowledge-update": "knowledge-update",
    } as Record<string, string>)[entry.question_type] ?? "information-extraction";
};

const locomo_category = (value: number | undefined): string => ({
    1: "multi-hop",
    2: "temporal-reasoning",
    3: "open-domain",
    4: "single-hop",
    5: "adversarial",
} as Record<number, string>)[value ?? 4] ?? "single-hop";

const sample_by_category = (cases: benchmark_case[], per_category: number, sample_offset: number, stagger_corpora = false): benchmark_case[] => {
    const categories = [...new Set(cases.map((item) => item.category))];
    const used_corpora = new Set<string>();
    return categories.flatMap((category, category_index) => {
        const unique = [...new Map(cases.filter((item) => item.category === category).map((item) => [item.corpus_id, item])).values()];
        if (!unique.length) return [];
        const start = sample_offset + (stagger_corpora ? category_index * per_category : 0);
        const rotated = Array.from({ length: unique.length }, (_, index) => unique[(start + index) % unique.length]);
        const ordered = stagger_corpora
            ? [...rotated.filter((item) => !used_corpora.has(item.corpus_id)), ...rotated.filter((item) => used_corpora.has(item.corpus_id))]
            : rotated;
        const chosen = ordered.slice(0, Math.min(per_category, unique.length));
        for (const item of chosen) used_corpora.add(item.corpus_id);
        return chosen;
    });
};

export function load_longmemeval(path: string, per_category: number, sample_offset = 0): dataset_load {
    const entries = JSON.parse(readFileSync(path, "utf8")) as longmem_entry[];
    const cases = entries.map((entry): benchmark_case => {
        const evidence_sessions = new Set(entry.answer_session_ids ?? []);
        const has_turn_annotations = entry.haystack_sessions.some((turns) => turns.some((turn) => turn.has_answer === true));
        const events: benchmark_event[] = [];
        const evidence_ids: string[] = [];
        for (let session_index = 0; session_index < entry.haystack_sessions.length; session_index++) {
            const session_id = entry.haystack_session_ids[session_index] ?? `session_${session_index}`;
            const session_time = timestamp(entry.haystack_dates[session_index], base_time + session_index * day_ms);
            const turns = entry.haystack_sessions[session_index] ?? [];
            for (let turn_index = 0; turn_index < turns.length; turn_index++) {
                const turn = turns[turn_index];
                const id = `${entry.question_id}:${session_id}:${turn_index}`;
                events.push({
                    id,
                    text: turn.content ?? "",
                    timestamp: session_time + turn_index,
                    metadata: { dataset: "longmemeval", session_id, role: turn.role ?? "speaker" },
                });
                if (turn.has_answer === true || (!has_turn_annotations && evidence_sessions.has(session_id))) evidence_ids.push(id);
            }
        }
        return {
            id: entry.question_id,
            corpus_id: entry.question_id,
            dataset: "longmemeval",
            category: longmem_category(entry),
            question: entry.question,
            answer: String(entry.answer ?? ""),
            user_id: entry.question_id,
            events,
            evidence_ids: entry.question_id.endsWith("_abs") ? [] : evidence_ids,
            forbidden_ids: [],
            question_date: entry.question_date,
        };
    });
    return {
        name: "longmemeval",
        official: true,
        source: "https://huggingface.co/datasets/xiaowu0162/longmemeval-cleaned",
        path,
        cases: sample_by_category(cases, per_category, sample_offset),
    };
}

export function load_locomo(path: string, per_category: number, sample_offset = 0): dataset_load {
    const entries = JSON.parse(readFileSync(path, "utf8")) as locomo_entry[];
    const cases: benchmark_case[] = [];
    for (const entry of entries) {
        const events = new Map<string, benchmark_event>();
        const session_keys = Object.keys(entry.conversation).filter((key) => /^session_\d+$/.test(key)).sort((left, right) => Number(left.slice(8)) - Number(right.slice(8)));
        for (const key of session_keys) {
            const session_number = Number(key.slice(8));
            const session_time = timestamp(entry.conversation[`${key}_date_time`] as string | undefined, base_time + session_number * day_ms);
            const turns = (entry.conversation[key] as locomo_turn[] | undefined) ?? [];
            for (let index = 0; index < turns.length; index++) {
                const turn = turns[index];
                const id = turn.dia_id ?? `${entry.sample_id}:${key}:${index}`;
                events.set(id, {
                    id,
                    text: `${turn.speaker ?? "speaker"}: ${turn.text ?? ""}${turn.blip_caption ? ` [image: ${turn.blip_caption}]` : ""}`,
                    timestamp: session_time + index,
                    metadata: { dataset: "locomo", session: key, speaker: turn.speaker ?? "speaker" },
                });
            }
        }
        for (let index = 0; index < (entry.qa ?? []).length; index++) {
            const question = entry.qa![index];
            cases.push({
                id: `${entry.sample_id}:qa:${index}`,
                corpus_id: entry.sample_id,
                dataset: "locomo",
                category: locomo_category(question.category),
                question: question.question ?? "",
                answer: String(question.answer ?? ""),
                user_id: entry.sample_id,
                events: [...events.values()],
                evidence_ids: (question.evidence ?? []).filter((id) => events.has(id)),
                forbidden_ids: [],
            });
        }
    }
    return {
        name: "locomo",
        official: true,
        source: "https://github.com/snap-research/locomo",
        path,
        cases: sample_by_category(cases, per_category, sample_offset, true),
    };
}
