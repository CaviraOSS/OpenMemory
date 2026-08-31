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
 *  file  : benchmarks/src/datasets/smoke.ts
 *  usage : supports LongMemory benchmark smoke
 */


import type { benchmark_case, benchmark_event } from "../types";

const day_ms = 86_400_000;
const base_time = Date.UTC(2026, 0, 1);
const user_id = "smoke-user";

const event = (id: string, text: string, day: number): benchmark_event => ({
    id,
    text,
    timestamp: base_time + day * day_ms,
    metadata: { dataset: "smoke" },
});

const smoke_definitions: Array<Omit<benchmark_case, "corpus_id">> = [
    {
        id: "smoke:extraction", dataset: "smoke", category: "information-extraction", user_id,
        question: "Who is my dentist?", answer: "Dr. Lin",
        events: [event("extract:noise", "I bought basil for dinner", 0), event("extract:evidence", "My dentist is Dr. Lin", 1)],
        evidence_ids: ["extract:evidence"], forbidden_ids: [],
    },
    {
        id: "smoke:preference", dataset: "smoke", category: "preference", user_id,
        question: "Which editor do I prefer?", answer: "Vim",
        events: [event("pref:noise", "The team uses several editors", 0), event("pref:evidence", "I consistently prefer Vim for editing code", 1)],
        evidence_ids: ["pref:evidence"], forbidden_ids: [],
    },
    {
        id: "smoke:multi-session", dataset: "smoke", category: "multi-session", user_id,
        question: "Where and when is my conference trip?", answer: "Kyoto on April 8",
        events: [event("trip:place", "The conference is in Kyoto", 0), event("trip:date", "My conference flight leaves on April 8", 2)],
        evidence_ids: ["trip:place", "trip:date"], forbidden_ids: [],
    },
    {
        id: "smoke:temporal", dataset: "smoke", category: "temporal-reasoning", user_id,
        question: "What happened after the design review?", answer: "The API was deployed",
        events: [event("time:first", "The design review finished on Monday", 0), event("time:next", "After the design review the API was deployed on Tuesday", 1)],
        evidence_ids: ["time:next"], forbidden_ids: [],
    },
    {
        id: "smoke:update", dataset: "smoke", category: "knowledge-update", user_id,
        question: "Where is the production server now?", answer: "Sweden",
        events: [event("update:old", "The production server used to be in Finland", 0), event("update:new", "The production server is now in Sweden", 5)],
        evidence_ids: ["update:new"], forbidden_ids: ["update:old"],
    },
    {
        id: "smoke:abstention", dataset: "smoke", category: "abstention", user_id,
        question: "What is my passport number?", answer: "not present",
        events: [event("abstain:noise", "I renewed my library card", 0)],
        evidence_ids: [], forbidden_ids: [],
    },
    {
        id: "smoke:single-hop", dataset: "smoke", category: "single-hop", user_id,
        question: "What instrument did Maya start learning?", answer: "cello",
        events: [event("single:evidence", "Maya started learning the cello", 0)],
        evidence_ids: ["single:evidence"], forbidden_ids: [],
    },
    {
        id: "smoke:multi-hop", dataset: "smoke", category: "multi-hop", user_id,
        question: "Which hobby did Sam resume after moving?", answer: "painting",
        events: [event("hop:move", "Sam moved into a brighter apartment", 0), event("hop:hobby", "The bright studio let Sam resume painting", 3)],
        evidence_ids: ["hop:move", "hop:hobby"], forbidden_ids: [],
    },
    {
        id: "smoke:open-domain", dataset: "smoke", category: "open-domain", user_id,
        question: "Why did Priya carry an umbrella?", answer: "rain was forecast",
        events: [event("open:evidence", "Rain was forecast, so Priya packed an umbrella", 0)],
        evidence_ids: ["open:evidence"], forbidden_ids: [],
    },
    {
        id: "smoke:adversarial", dataset: "smoke", category: "adversarial", user_id,
        question: "Did Noah say he owned a helicopter?", answer: "not mentioned",
        events: [event("adversarial:noise", "Noah watched a documentary about helicopters", 0)],
        evidence_ids: [], forbidden_ids: [],
    },
    {
        id: "smoke:summary", dataset: "smoke", category: "event-summary", user_id,
        question: "Summarize the launch sequence", answer: "review, deploy, monitor",
        events: [event("summary:review", "The team reviewed the release", 0), event("summary:deploy", "The team deployed the release", 1), event("summary:monitor", "The team monitored the release", 2)],
        evidence_ids: ["summary:review", "summary:deploy", "summary:monitor"], forbidden_ids: [],
    },
];

export const smoke_cases: benchmark_case[] = smoke_definitions.map((item) => ({ ...item, corpus_id: item.id }));
