import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { load_locomo, load_longmemeval, smoke_cases } from "../src/datasets";

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
        const directory = mkdtempSync(join(tmpdir(), "openmemory-longmem-"));
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
        const directory = mkdtempSync(join(tmpdir(), "openmemory-longmem-turns-"));
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
        const directory = mkdtempSync(join(tmpdir(), "openmemory-longmem-offset-"));
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

    it("parses LoCoMo human-readable session timestamps", () => {
        const directory = mkdtempSync(join(tmpdir(), "openmemory-locomo-date-"));
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
        const directory = mkdtempSync(join(tmpdir(), "openmemory-locomo-"));
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
        const directory = mkdtempSync(join(tmpdir(), "openmemory-locomo-corpora-"));
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
