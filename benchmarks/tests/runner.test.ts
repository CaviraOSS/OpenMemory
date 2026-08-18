import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { run_benchmark } from "../src/runner";
import { markdown } from "../src/report";
import type { ai_judge, benchmark_event, benchmark_provider, benchmark_scope, ingest_result, judge_input, language_model, model_config, model_request, model_response, provider_config, search_hit } from "../src/types";

const directories: string[] = [];

class fake_provider implements benchmark_provider {
    readonly name = "openmemory" as const;
    readonly display_name = "fake openmemory";
    health_calls = 0;
    ingest_calls = 0;
    private events: benchmark_event[] = [];

    constructor(private readonly offline = false) { }

    async initialize(_config: provider_config): Promise<void> { }
    async health(): Promise<void> {
        this.health_calls++;
        if (this.offline) throw new Error("offline");
    }
    async reset(_scope: benchmark_scope): Promise<void> {
        this.events = [];
    }
    async ingest(events: benchmark_event[]): Promise<ingest_result> {
        this.ingest_calls++;
        this.events = events;
        return { ids: events.map((event) => event.id) };
    }
    async await_indexing(_result: ingest_result, _scope: benchmark_scope): Promise<void> { }
    async search(_query: string, _limit: number, _scope: benchmark_scope): Promise<search_hit[]> {
        return this.events.map((event) => ({ text: event.text, metadata: { source_event_id: event.id } }));
    }
    async close(): Promise<void> { }
}

class fake_model implements language_model {
    readonly provider = "openai" as const;
    readonly model = "fake-model";
    calls = 0;

    async generate(_request: model_request): Promise<model_response> {
        this.calls++;
        return { text: "a grounded answer", prompt_tokens: 20, completion_tokens: 4 };
    }
}

class fake_judge implements ai_judge {
    readonly name = "fake-judge";
    readonly model = "fake-judge-model";
    calls = 0;

    async evaluate(_input: judge_input) {
        this.calls++;
        return { score: 1, label: "correct" as const, explanation: "matches", raw: '{"score":1}' };
    }
}

const ai_config = (model: string): model_config => ({
    provider: "openai",
    model,
    api_key: "secret",
    timeout_ms: 1_000,
    max_retries: 1,
    max_tokens: 100,
    temperature: 0,
});

afterEach(() => {
    vi.unstubAllEnvs();
    for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("benchmark runner", () => {
    it("builds competitor-only manifests with an OpenMemory embedding environment", async () => {
        const output_dir = mkdtempSync(join(tmpdir(), "openmemory-bench-competitor-"));
        directories.push(output_dir);
        vi.stubEnv("OPENMEMORY_EMBEDDING_PROVIDER", "gemini");
        vi.stubEnv("OPENMEMORY_EMBEDDING_TIER", "deep");
        vi.stubEnv("OPENMEMORY_EMBEDDING_DIMENSION", "768");
        const provider = new fake_provider() as benchmark_provider;
        Object.defineProperty(provider, "name", { value: "graphiti" });
        const result = await run_benchmark({
            providers: ["graphiti"],
            datasets: ["smoke"],
            configs: { graphiti: { base_url: "https://example.invalid" } },
            run_id: "competitor-test",
            output_dir,
            resume: false,
            make_provider: () => provider,
        });
        expect(result.report.providers[0]).toMatchObject({ name: "graphiti", status: "completed" });
        expect(result.report.manifest.openmemory_embedding?.batch_size).toBe(100);
    });

    it("checkpoints phases, resumes offline, rejects drift, and supports replacement", async () => {
        const output_dir = mkdtempSync(join(tmpdir(), "openmemory-bench-"));
        directories.push(output_dir);
        const base = {
            providers: ["openmemory" as const],
            datasets: ["smoke" as const],
            configs: { openmemory: { base_url: "embedded://test", api_key: "secret" } },
            run_id: "runner-test",
            output_dir,
        };
        const first = new fake_provider();
        const first_result = await run_benchmark({ ...base, make_provider: () => first });
        expect(first.ingest_calls).toBe(11);
        expect(first_result.report.providers[0]).toMatchObject({ status: "completed", questions: 11, failed_questions: 0 });
        expect(first_result.report.providers[0].memscore?.startsWith(`${(first_result.report.providers[0].metrics.find((metric) => metric.k === 5)!.hit_rate * 100).toFixed(0)}%`)).toBe(true);
        expect(first_result.report.providers[0].cases.every((item) => item.phases.evaluate.status === "completed")).toBe(true);
        expect(JSON.stringify(first_result.report.manifest)).not.toContain("secret");

        const resumed = new fake_provider(true);
        const resumed_result = await run_benchmark({ ...base, make_provider: () => resumed });
        expect(resumed.health_calls).toBe(0);
        expect(resumed.ingest_calls).toBe(0);
        expect(resumed_result.report.providers[0].status).toBe("completed");

        await expect(run_benchmark({ ...base, cutoffs: [1, 10], make_provider: () => new fake_provider() })).rejects.toThrow("different manifest");

        const replacement = new fake_provider();
        await run_benchmark({ ...base, cutoffs: [1, 10], resume: false, make_provider: () => replacement });
        expect(replacement.ingest_calls).toBe(11);
    });

    it("reports provider initialization failures", async () => {
        const output_dir = mkdtempSync(join(tmpdir(), "openmemory-bench-failure-"));
        directories.push(output_dir);
        const provider = new fake_provider();
        provider.initialize = async () => { throw new Error("configuration failed"); };
        const result = await run_benchmark({
            providers: ["openmemory"],
            datasets: ["smoke"],
            run_id: "failure-test",
            output_dir,
            resume: false,
            make_provider: () => provider,
        });
        expect(result.report.providers[0]).toMatchObject({ status: "failed", reason: "configuration failed", failed_questions: 11 });
        expect(result.report.gates.passed).toBe(false);
        const report_markdown = markdown(result.report);
        expect(report_markdown).toContain("| fake openmemory | smoke | 0 | 11 | 0 | - | - | - | - | - |");
        expect(report_markdown).toContain("| Provider | Case | Phase | Duration | Error |");
    });

    it("rejects retrieval-only official dataset runs", async () => {
        const output_dir = mkdtempSync(join(tmpdir(), "openmemory-bench-official-"));
        directories.push(output_dir);
        await expect(run_benchmark({
            providers: ["openmemory"],
            datasets: ["longmemeval"],
            per_category: 1,
            output_dir,
            resume: false,
            make_provider: () => new fake_provider(),
        })).rejects.toThrow("require --answerer and --judge");
    });

    it("requires distinct official answerer and judge models", async () => {
        const output_dir = mkdtempSync(join(tmpdir(), "openmemory-bench-distinct-"));
        directories.push(output_dir);
        await expect(run_benchmark({
            providers: ["openmemory"],
            datasets: ["longmemeval"],
            per_category: 1,
            output_dir,
            resume: false,
            answerer_config: ai_config("same-model"),
            judge_config: ai_config("same-model"),
            make_provider: () => new fake_provider(),
            make_model: () => new fake_model(),
            make_judge: () => new fake_judge(),
        })).rejects.toThrow("distinct answerer and judge");
    });

    it("generates and judges a fresh answer at every cutoff", async () => {
        const output_dir = mkdtempSync(join(tmpdir(), "openmemory-bench-judge-"));
        directories.push(output_dir);
        const answerer = new fake_model();
        const judge_model = new fake_model();
        const judge = new fake_judge();
        const result = await run_benchmark({
            providers: ["openmemory"],
            datasets: ["smoke"],
            run_id: "judge-test",
            output_dir,
            resume: false,
            answerer_config: { ...ai_config("answerer"), command: join("private", "answerer.exe") },
            judge_config: { ...ai_config("judge"), command: join("private", "judge.exe") },
            make_provider: () => new fake_provider(),
            make_model: (_config, role) => role === "answerer" ? answerer : judge_model,
            make_judge: () => judge,
        });
        expect(answerer.calls).toBe(44);
        expect(judge.calls).toBe(44);
        expect(result.report.manifest.ai).toMatchObject({ enabled: true, per_cutoff: true });
        expect(result.report.manifest.ai.answerer?.command).toBe("answerer.exe");
        expect(JSON.stringify(result.report.manifest)).not.toContain("private");
        expect(JSON.stringify(result.report.manifest)).not.toContain("secret");
        expect(result.report.providers[0].answer_accuracy).toEqual({ top_1: 1, top_5: 1, top_10: 1, top_20: 1 });
        expect(result.report.providers[0].ai_cutoffs.top_20.tokens).toMatchObject({ prompt: 20, completion: 4 });
        expect(result.report.providers[0].datasets).toMatchObject([{ dataset: "smoke", questions: 11, failed_questions: 0 }]);
        expect(result.report.providers[0].cases.every((item) => item.dataset === "smoke")).toBe(true);
        expect(result.report.providers[0].cases.every((item) => item.phases.answer.status === "completed" && item.phases.judge.status === "completed")).toBe(true);
        expect(result.report.gates.passed).toBe(true);
        const report_markdown = markdown(result.report);
        expect(report_markdown).toContain("AI Answer Evaluation");
        expect(report_markdown).toContain("## Dataset Breakdown");
        expect(report_markdown).toContain("| fake openmemory | smoke | 11 | 0 |");
        expect(report_markdown).toContain("answerer openai:answerer");
        expect(report_markdown).not.toContain("secret");
    });

    it("ingests a shared corpus once for independent questions", async () => {
        const output_dir = mkdtempSync(join(tmpdir(), "openmemory-bench-corpus-"));
        directories.push(output_dir);
        const provider = new fake_provider();
        const shared_events: benchmark_event[] = [{ id: "shared", text: "The shared fact is blue", timestamp: 1, metadata: { dataset: "smoke" } }];
        const cases = ["one", "two"].map((id) => ({
            id: `case:${id}`,
            corpus_id: "shared-corpus",
            dataset: "smoke" as const,
            category: "information-extraction",
            question: "What color is the shared fact?",
            answer: "blue",
            user_id: "user",
            events: shared_events,
            evidence_ids: ["shared"],
            forbidden_ids: [],
        }));
        const result = await run_benchmark({
            providers: ["openmemory"],
            datasets: ["smoke"],
            run_id: "corpus-test",
            output_dir,
            resume: false,
            make_provider: () => provider,
            load_datasets: () => [{ name: "smoke", official: false, source: "test", path: null, cases }],
        });
        expect(provider.ingest_calls).toBe(1);
        expect(result.report.providers[0]).toMatchObject({ questions: 2, status: "completed" });
        expect(result.report.providers[0].cases.filter((item) => item.ingest_reused)).toHaveLength(1);
        expect(result.report.providers[0].latency.ingest.count).toBe(1);
    });

    it("scores raw retrieval before trimming answer context", async () => {
        const output_dir = mkdtempSync(join(tmpdir(), "openmemory-bench-raw-retrieval-"));
        directories.push(output_dir);
        const provider = new fake_provider();
        provider.search = async () => [{ text: `${"noise ".repeat(5_000)}The shared fact is blue`, metadata: {} }];
        const item = {
            id: "raw-retrieval",
            corpus_id: "raw-retrieval",
            dataset: "smoke" as const,
            category: "information-extraction",
            question: "What color is the shared fact?",
            answer: "blue",
            user_id: "user",
            events: [{ id: "evidence", text: "The shared fact is blue", timestamp: 1, metadata: {} }],
            evidence_ids: ["evidence"],
            forbidden_ids: [],
        };
        const result = await run_benchmark({
            providers: ["openmemory"],
            datasets: ["smoke"],
            cutoffs: [1],
            output_dir,
            resume: false,
            make_provider: () => provider,
            load_datasets: () => [{ name: "smoke", official: false, source: "test", path: null, cases: [item] }],
        });
        expect(result.report.providers[0].metrics[0].hit_rate).toBe(1);
        expect(result.report.providers[0].average_context_tokens).toBeLessThanOrEqual(2_048);
    });
});
