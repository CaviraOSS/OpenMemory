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
 *  file  : benchmarks/src/datasets/beam.ts
 *  usage : supports LongMemory benchmark beam
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { benchmark_case, benchmark_event, dataset_load } from "../types";

export type beam_bucket = "1M" | "10M";

const day_ms = 86_400_000;
const base_time = Date.UTC(2024, 0, 1);

const categories: Record<string, string> = {
    abstention: "abstention",
    contradiction_resolution: "contradiction-resolution",
    event_ordering: "event-ordering",
    information_extraction: "information-extraction",
    instruction_following: "instruction-following",
    knowledge_update: "knowledge-update",
    multi_session_reasoning: "multi-session",
    preference_following: "preference",
    summarization: "event-summary",
    temporal_reasoning: "temporal-reasoning",
};

type beam_turn = { role?: string; id?: number; time_anchor?: string; index?: string; question_type?: string; content?: string };
type beam_batch = { batch_number?: number; turns?: beam_turn[][] };
type beam_question = { question?: string; ideal_response?: string; ideal_answer?: string; difficulty?: string; plan_reference?: string };

const anchor_time = (value: string | undefined): number | null => {
    if (!value) return null;
    const parsed = Date.parse(value.replace(/-/g, " ").trim());
    return Number.isFinite(parsed) ? parsed : null;
};

const content_text = (turn: beam_turn): string => (turn.content ?? "").replace(/\s*->->\s*[\d,]+\s*$/, "").trim();

export function beam_events(conversation_id: string, bucket: beam_bucket, chat: unknown): { events: benchmark_event[]; latest_time: number } {
    const batches: beam_batch[] = [];
    if (Array.isArray(chat)) {
        for (const entry of chat) {
            if (entry && typeof entry === "object" && Array.isArray((entry as beam_batch).turns)) batches.push(entry as beam_batch);
            else if (entry && typeof entry === "object") for (const value of Object.values(entry)) if (Array.isArray(value)) batches.push(...(value as beam_batch[]).filter((batch) => batch && Array.isArray(batch.turns)));
        }
    }
    const events: benchmark_event[] = [];
    let anchor = base_time;
    for (const batch of batches) {
        for (const pair of batch.turns ?? []) {
            for (const turn of pair) {
                anchor = anchor_time(turn.time_anchor) ?? anchor;
                const index = events.length;
                events.push({
                    id: `${conversation_id}:b${batch.batch_number ?? 0}:t${index}`,
                    text: content_text(turn),
                    timestamp: anchor + index,
                    metadata: { dataset: `beam-${bucket.toLowerCase()}`, bucket, batch: batch.batch_number ?? 0, role: turn.role ?? "speaker", index: turn.index ?? null, question_type: turn.question_type ?? null },
                });
            }
        }
    }
    return { events, latest_time: events.at(-1)?.timestamp ?? base_time };
}

export function beam_cases(conversation_id: string, bucket: beam_bucket, events: benchmark_event[], questions: Record<string, unknown>, latest_time: number): benchmark_case[] {
    const cases: benchmark_case[] = [];
    for (const [raw_category, entries] of Object.entries(questions)) {
        if (!Array.isArray(entries)) continue;
        const category = categories[raw_category] ?? raw_category.replaceAll("_", "-");
        for (let index = 0; index < entries.length; index++) {
            const entry = entries[index] as beam_question;
            if (!entry?.question) continue;
            cases.push({
                id: `${conversation_id}:${raw_category}:${index}`,
                corpus_id: conversation_id,
                dataset: `beam-${bucket.toLowerCase()}` as benchmark_case["dataset"],
                category,
                question: entry.question,
                answer: String(entry.ideal_response ?? entry.ideal_answer ?? ""),
                user_id: conversation_id,
                events,
                evidence_ids: [],
                evidence_unknown: true,
                forbidden_ids: [],
                question_date: new Date(latest_time).toISOString(),
            });
        }
    }
    return cases;
}

export function load_beam(dir: string, bucket: beam_bucket, conversations: number, sample_offset = 0): dataset_load {
    const root = resolve(dir, bucket);
    if (!existsSync(root)) throw new Error(`beam-${bucket.toLowerCase()} data is missing at ${root}; run pnpm bench:data`);
    const ids = readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory() && existsSync(join(root, entry.name, "chat.json")) && existsSync(join(root, entry.name, "probing_questions.json"))).map((entry) => Number(entry.name)).filter((id) => Number.isInteger(id)).sort((left, right) => left - right);
    if (!ids.length) throw new Error(`beam-${bucket.toLowerCase()} contains no complete conversations at ${root}; run pnpm bench:data`);
    const rotated = Array.from({ length: ids.length }, (_, index) => ids[(sample_offset + index) % ids.length]);
    const chosen = rotated.slice(0, Math.max(1, Math.min(conversations, ids.length)));
    const cases: benchmark_case[] = [];
    for (const id of chosen) {
        const conversation_id = `beam-${bucket.toLowerCase()}-conv-${id}`;
        const chat = JSON.parse(readFileSync(join(root, String(id), "chat.json"), "utf8")) as unknown;
        const questions = JSON.parse(readFileSync(join(root, String(id), "probing_questions.json"), "utf8")) as Record<string, unknown>;
        const { events, latest_time } = beam_events(conversation_id, bucket, chat);
        cases.push(...beam_cases(conversation_id, bucket, events, questions, latest_time));
    }
    return {
        name: `beam-${bucket.toLowerCase()}` as dataset_load["name"],
        official: true,
        source: "https://github.com/mohammadtavakoli78/BEAM",
        path: root,
        cases,
    };
}
