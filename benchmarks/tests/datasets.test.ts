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
 *  file  : benchmarks/tests/datasets.test.ts
 *  usage : verifies LongMemory datasets.test behavior
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { load_beam, load_locomo, load_longmemeval, smoke_cases } from "../src/datasets";

const directories: string[] = [];

afterEach(() => {
    for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("benchmark datasets", () => {
    it("covers the full smoke taxonomy", () => {
        expect(smoke_cases).toHaveLength(11);
        expect(new Set(smoke_cases.map((item) => item.category)).size).toBe(11);
        expect(smoke_cases.every((item) => item.events.length > 0)).toBe(true);
    });

    it("keeps longmemeval evidence ids out of provider event metadata", () => {
        const directory = mkdtempSync(join(tmpdir(), "longmemory-longmem-"));
        directories.push(directory);
        const path = join(directory, "long.json");
        writeFileSync(path, JSON.stringify([{
            question_id: "question-1",
            question_type: "multi-session",
            question: "where?",
            answer: "kyoto",
            haystack_session_ids: ["session-a"],
            haystack_dates: ["2026-01-01"],
            haystack_sessions: [[{ role: "user", content: "in kyoto", has_answer: true }]],
            answer_session_ids: ["session-a"],
        }]));
        const loaded = load_longmemeval(path, 2);
        expect(loaded.cases[0].evidence_ids).toEqual(["question-1:session-a:0"]);
        expect(loaded.cases[0].events[0].metadata).not.toHaveProperty("source_event_id");
        expect(loaded.cases[0].events[0].metadata).toMatchObject({ role: "user" });
    });

    it("uses turn-level longmemeval oracle annotations when available", () => {
        const directory = mkdtempSync(join(tmpdir(), "longmemory-longmem-turns-"));
        directories.push(directory);
        const path = join(directory, "long.json");
        writeFileSync(path, JSON.stringify([{
            question_id: "question-2",
            question_type: "multi-session",
            question: "where?",
            answer: "kyoto",
            haystack_session_ids: ["session-a"],
            haystack_dates: ["2026-01-01"],
            haystack_sessions: [[
                { role: "user", content: "noise", has_answer: false },
                { role: "assistant", content: "in kyoto", has_answer: true },
            ]],
            answer_session_ids: ["session-a"],
        }]));
        const loaded = load_longmemeval(path, 2);
        expect(loaded.cases[0].evidence_ids).toEqual(["question-2:session-a:1"]);
    });

    it("selects deterministic per-category holdouts with sample offsets", () => {
        const directory = mkdtempSync(join(tmpdir(), "longmemory-longmem-offset-"));
        directories.push(directory);
        const path = join(directory, "long.json");
        const entry = (id: string) => ({
            question_id: id,
            question_type: "multi-session",
            question: "where?",
            answer: "kyoto",
            haystack_session_ids: [`session-${id}`],
            haystack_dates: ["2026-01-01"],
            haystack_sessions: [[{ role: "user", content: "in kyoto", has_answer: true }]],
            answer_session_ids: [`session-${id}`],
        });
        writeFileSync(path, JSON.stringify([entry("first"), entry("holdout"), entry("later")]));
        expect(load_longmemeval(path, 1, 1).cases.map((item) => item.id)).toEqual(["holdout"]);
    });

    it("loads BEAM conversations with normalized events and evidence-unknown questions", () => {
        const directory = mkdtempSync(join(tmpdir(), "longmemory-beam-"));
        directories.push(directory);
        const conversation = join(directory, "1M", "1");
        mkdirSync(conversation, { recursive: true });
        writeFileSync(join(conversation, "chat.json"), JSON.stringify([{
            batch_number: 1,
            turns: [[
                { role: "user", id: 0, time_anchor: "March-15-2024", index: "1,1", content: "I need a launch plan ->-> 1,1" },
                { role: "assistant", id: 1, content: "Here is the plan" },
            ]],
        }]));
        writeFileSync(join(conversation, "probing_questions.json"), JSON.stringify({
            abstention: [{ question: "What did users say?", ideal_response: "no information", difficulty: "easy" }],
            event_ordering: [{ question: "What happened first?", ideal_response: "planning", difficulty: "medium" }],
        }));
        const loaded = load_beam(directory, "1M", 1);
        expect(loaded.cases).toHaveLength(2);
        expect(loaded.cases.map((item) => item.category).sort()).toEqual(["abstention", "event-ordering"]);
        expect(loaded.cases[0].evidence_unknown).toBe(true);
        expect(loaded.cases[0].evidence_ids).toEqual([]);
        expect(loaded.cases[0].events).toHaveLength(2);
        expect(loaded.cases[0].events[0].text).toBe("I need a launch plan");
        expect(loaded.cases[0].events[0].timestamp).toBe(Date.parse("March 15 2024"));
    });

    it("flattens BEAM 10M plan-nested chats", () => {
        const directory = mkdtempSync(join(tmpdir(), "longmemory-beam10-"));
        directories.push(directory);
        const conversation = join(directory, "10M", "2");
        mkdirSync(conversation, { recursive: true });
        writeFileSync(join(conversation, "chat.json"), JSON.stringify([
            { "plan-1": [{ batch_number: 1, turns: [[{ role: "user", content: "plan one" }]] }] },
            { "plan-2": [{ batch_number: 2, turns: [[{ role: "user", content: "plan two" }]] }] },
        ]));
        writeFileSync(join(conversation, "probing_questions.json"), JSON.stringify({ multi_session_reasoning: [{ question: "across plans?", ideal_answer: "both", difficulty: "hard" }] }));
        const loaded = load_beam(directory, "10M", 5);
        expect(loaded.cases).toHaveLength(1);
        expect(loaded.cases[0]).toMatchObject({ dataset: "beam-10m", category: "multi-session", answer: "both" });
        expect(loaded.cases[0].events.map((event) => event.text)).toEqual(["plan one", "plan two"]);
    });

    it("parses LoCoMo human-readable session timestamps", () => {
        const directory = mkdtempSync(join(tmpdir(), "longmemory-locomo-date-"));
        directories.push(directory);
        const path = join(directory, "locomo.json");
        writeFileSync(path, JSON.stringify([{
            sample_id: "sample-date",
            conversation: { session_1_date_time: "1:14 pm on 25 May, 2023", session_1: [{ speaker: "Melanie", dia_id: "d1", text: "last Saturday" }] },
            qa: [{ question: "when?", answer: "May", category: 2, evidence: ["d1"] }],
        }]));
        expect(load_locomo(path, 1).cases[0].events[0].timestamp).toBe(Date.parse("May 25, 2023 1:14 pm"));
    });

    it("preserves locomo dialog evidence ids", () => {
        const directory = mkdtempSync(join(tmpdir(), "longmemory-locomo-"));
        directories.push(directory);
        const path = join(directory, "locomo.json");
        writeFileSync(path, JSON.stringify([{
            sample_id: "sample-1",
            conversation: {
                session_1_date_time: "2026-01-01",
                session_1: [{ speaker: "maya", dia_id: "d1", text: "learning cello" }],
            },
            qa: [{ question: "instrument?", answer: "cello", category: 4, evidence: ["d1"] }],
        }]));
        const loaded = load_locomo(path, 2);
        expect(loaded.cases[0]).toMatchObject({ category: "single-hop", evidence_ids: ["d1"] });
        expect(loaded.cases[0].events[0].metadata).not.toHaveProperty("source_event_id");
    });

    it("samples LoCoMo categories across distinct conversations", () => {
        const directory = mkdtempSync(join(tmpdir(), "longmemory-locomo-corpora-"));
        directories.push(directory);
        const path = join(directory, "locomo.json");
        const entry = (sample_id: string) => ({
            sample_id,
            conversation: { session_1_date_time: "2026-01-01", session_1: [{ speaker: "maya", dia_id: `${sample_id}:d1`, text: "learning cello" }] },
            qa: [
                { question: "instrument one?", answer: "cello", category: 4, evidence: [`${sample_id}:d1`] },
                { question: "instrument duplicate?", answer: "cello", category: 4, evidence: [`${sample_id}:d1`] },
            ],
        });
        writeFileSync(path, JSON.stringify([entry("sample-1"), entry("sample-2"), entry("sample-3")]));
        expect(load_locomo(path, 2).cases.map((item) => item.corpus_id)).toEqual(["sample-1", "sample-2"]);
        expect(load_locomo(path, 1, 1).cases.map((item) => item.corpus_id)).toEqual(["sample-2"]);
    });
});
