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
 *  file  : benchmarks/tests/ai.test.ts
 *  usage : verifies LongMemory ai.test behavior
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parse_judge_response } from "../src/ai/judge";
import { http_language_model } from "../src/ai/model";
import { build_answer_prompt, judge_rules } from "../src/ai/prompts";
import { smoke_cases } from "../src/datasets";
import { model_config_from_spec } from "../src/config";
import type { model_config } from "../src/types";

type request_record = { path: string; headers: IncomingMessage["headers"]; body: Record<string, unknown> };
const close_servers: Array<() => Promise<void>> = [];
const directories: string[] = [];

async function server(handler: (request: request_record, response: ServerResponse) => void): Promise<string> {
    const instance = createServer(async (request, response) => {
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(Buffer.from(chunk));
        handler({ path: request.url ?? "/", headers: request.headers, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown> }, response);
    });
    await new Promise<void>((resolve) => instance.listen(0, "127.0.0.1", resolve));
    const address = instance.address();
    if (!address || typeof address === "string") throw new Error("test server failed to bind");
    close_servers.push(() => new Promise<void>((resolve, reject) => instance.close((error) => error ? reject(error) : resolve())));
    return `http://127.0.0.1:${address.port}`;
}

const respond = (response: ServerResponse, value: unknown, status = 200): void => {
    response.statusCode = status;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(value));
};

const config = (provider: model_config["provider"], model: string, base_url: string): model_config => ({
    provider,
    model,
    base_url,
    api_key: "secret",
    timeout_ms: 2_000,
    max_retries: 2,
    max_tokens: 100,
    temperature: 0,
});

afterEach(async () => {
    await Promise.all(close_servers.splice(0).map((close) => close()));
    for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("AI model clients", () => {
    it("uses OpenAI JSON mode and reasoning-model parameters", async () => {
        const requests: request_record[] = [];
        const base_url = await server((request, response) => {
            requests.push(request);
            respond(response, { choices: [{ message: { content: "{\"score\":1}" } }], usage: { prompt_tokens: 10, completion_tokens: 2 } });
        });
        const normal = new http_language_model(config("openai", "gpt-4.1-mini", base_url));
        const result = await normal.generate({ user: "judge", json: true });
        expect(result).toMatchObject({ text: "{\"score\":1}", prompt_tokens: 10, completion_tokens: 2 });
        expect(requests[0].body).toMatchObject({ max_tokens: 100, temperature: 0, response_format: { type: "json_object" } });

        const reasoning = new http_language_model(config("openai", "gpt-5-mini", base_url));
        await reasoning.generate({ user: "answer" });
        expect(requests[1].body).toMatchObject({ max_completion_tokens: 100 });
        expect(requests[1].body).not.toHaveProperty("temperature");
    });

    it("normalizes Anthropic and Google responses", async () => {
        const anthropic_url = await server((_request, response) => respond(response, { content: [{ type: "text", text: "anthropic answer" }], usage: { input_tokens: 8, output_tokens: 3 } }));
        const anthropic = new http_language_model(config("anthropic", "claude-test", anthropic_url));
        expect(await anthropic.generate({ user: "answer" })).toMatchObject({ text: "anthropic answer", prompt_tokens: 8, completion_tokens: 3 });

        const google_url = await server((_request, response) => respond(response, { candidates: [{ content: { parts: [{ text: "google answer" }] } }], usageMetadata: { promptTokenCount: 7, candidatesTokenCount: 2 } }));
        const google = new http_language_model(config("google", "gemini-test", google_url));
        expect(await google.generate({ user: "answer" })).toMatchObject({ text: "google answer", prompt_tokens: 7, completion_tokens: 2 });
    });

    it("uses the Ollama chat API with deterministic options", async () => {
        const requests: request_record[] = [];
        const base_url = await server((request, response) => {
            requests.push(request);
            respond(response, { message: { role: "assistant", content: "ollama answer" }, prompt_eval_count: 6, eval_count: 3 });
        });
        const ollama = new http_language_model(config("ollama", "qwen3", base_url));
        expect(await ollama.generate({ system: "system", user: "answer", json: true })).toMatchObject({ text: "ollama answer", prompt_tokens: 6, completion_tokens: 3 });
        expect(requests[0]).toMatchObject({ path: "/api/chat", body: { model: "qwen3", stream: false, think: false, format: "json", options: { seed: 0, temperature: 0, num_predict: 100 } } });
    });

    it("runs Codex and Claude Code through non-interactive local CLI contracts", async () => {
        const directory = mkdtempSync(join(tmpdir(), "longmemory-cli-models-"));
        directories.push(directory);
        const command = join(directory, "fake-cli.js");
        writeFileSync(command, `
        const fs = require("node:fs");
        const args = process.argv.slice(2);
        let input = "";
        process.stdin.setEncoding("utf8");
        process.stdin.on("data", value => input += value);
        process.stdin.on("end", () => {
            if (args[0] === "exec") {
                if (!input.includes("USER REQUEST")) process.exit(10);
                if (!args.includes("--ephemeral") || !args.includes("read-only")) process.exit(11);
                const output = args[args.indexOf("--output-last-message") + 1];
                fs.writeFileSync(output, args.includes("--output-schema") ? '{"score":1,"label":"correct","explanation":"codex"}' : "codex answer");
                process.stdout.write(JSON.stringify({ type: "turn.completed", usage: { input_tokens: 14, output_tokens: 5 } }) + "\\n");
                return;
            }
            if (args.includes("--no-custom-instructions")) {
                if (!args.includes("--disable-builtin-mcps") || !args.includes("--output-format") || !args.includes("gpt-5.6-luna")) process.exit(14);
                process.stdout.write(JSON.stringify({ type: "assistant.message", data: { phase: "final_answer", content: '{"score":1,"label":"correct","explanation":"copilot"}' } }) + "\\n");
                process.stdout.write(JSON.stringify({ type: "result", usage: { completionTokens: 7 } }) + "\\n");
                return;
            }
            if (input !== "answer" && input !== "judge") process.exit(13);
            if (!args.includes("-p") || !args.includes("--no-session-persistence") || !args.includes("--safe-mode")) process.exit(12);
            const payload = args.includes("--json-schema")
                ? { structured_output: { score: 1, label: "correct", explanation: "claude" }, usage: { input_tokens: 12, output_tokens: 4 } }
                : { result: "claude answer", usage: { input_tokens: 10, output_tokens: 3 } };
            process.stdout.write(JSON.stringify(payload));
        });
        `, "utf8");
        const codex_config = { ...config("codex", "gpt-5", ""), command };
        const codex = new http_language_model(codex_config);
        expect(await codex.generate({ system: "system", user: "answer" })).toMatchObject({ text: "codex answer", prompt_tokens: 14, completion_tokens: 5 });
        expect((await codex.generate({ user: "judge", json: true })).text).toContain('"score":1');

        const claude_config = { ...config("claude-code", "sonnet", ""), command };
        const claude = new http_language_model(claude_config);
        expect(await claude.generate({ system: "system", user: "answer" })).toMatchObject({ text: "claude answer", prompt_tokens: 10, completion_tokens: 3 });
        expect((await claude.generate({ user: "judge", json: true })).text).toContain('"label":"correct"');

        const copilot_config = { ...config("copilot", "gpt-5.6-luna", ""), command };
        const copilot = new http_language_model(copilot_config);
        expect(await copilot.generate({ user: "judge", json: true })).toMatchObject({
            text: '{"score":1,"label":"correct","explanation":"copilot"}', prompt_tokens: null, completion_tokens: 7,
        });
    });

    it("configures local providers without API keys", () => {
        expect(model_config_from_spec("ollama:qwen3", {})).toMatchObject({ provider: "ollama", api_key: "", base_url: "http://127.0.0.1:11434" });
        expect(model_config_from_spec("ollama:qwen3", { OLLAMA_HOST: "localhost:11434" })).toMatchObject({ base_url: "http://localhost:11434" });
        expect(model_config_from_spec("codex:gpt-test", { BENCH_CODEX_COMMAND: "codex-custom" })).toMatchObject({ provider: "codex", model: "gpt-test", command: "codex-custom", api_key: "" });
        expect(() => model_config_from_spec("codex:default", {})).toThrow("explicit model");
        expect(model_config_from_spec("claude-code:sonnet", { BENCH_CLAUDE_CODE_COMMAND: "claude-custom" })).toMatchObject({ provider: "claude-code", command: "claude-custom", api_key: "" });
        expect(model_config_from_spec("copilot:gpt-5.6-luna", { BENCH_COPILOT_COMMAND: "copilot-custom" })).toMatchObject({ provider: "copilot", command: "copilot-custom", api_key: "" });
        expect(model_config_from_spec("copilot-answerer:gpt-5.6-luna", { BENCH_COPILOT_ANSWERER_COMMAND: "copilot-a" })).toMatchObject({ provider: "copilot-answerer", command: "copilot-a", api_key: "" });
        expect(model_config_from_spec("copilot-judge:gpt-5.6-luna", { BENCH_COPILOT_JUDGE_COMMAND: "copilot-j" })).toMatchObject({ provider: "copilot-judge", command: "copilot-j", api_key: "" });
    });
});

describe("AI prompts and judge parsing", () => {
    it("builds grounded answer prompts and category judge rules", () => {
        const prompt = build_answer_prompt(smoke_cases[0], [{ text: "My dentist is Dr. Lin", metadata: {} }]);
        expect(prompt.user).toContain("My dentist is Dr. Lin");
        expect(prompt.system).toContain("only retrieved memories");
        expect(judge_rules("abstention")).toContain("abstention");
        expect(judge_rules("knowledge-update")).toContain("latest value");
    });

    it("gives open-domain and adversarial questions explicit policies", () => {
        const open = build_answer_prompt({ ...smoke_cases[0], category: "open-domain" }, []);
        const adversarial = build_answer_prompt({ ...smoke_cases[0], category: "adversarial" }, []);

        expect(open.system).toContain("ordinary general knowledge");
        expect(adversarial.system).toContain("does not establish that person's own reaction");
    });

    it("parses structured and fallback verdicts", () => {
        expect(parse_judge_response('{"score":1,"label":"correct","explanation":"matches"}')).toMatchObject({ score: 1, label: "correct" });
        expect(parse_judge_response("analysis\nNO")).toMatchObject({ score: 0, label: "incorrect" });
    });
});
