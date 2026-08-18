import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { language_model, model_config, model_request, model_response } from "../types";

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const record = (value: unknown): Record<string, unknown> => typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const text = (...values: unknown[]): string => values.find((value) => typeof value === "string") as string | undefined ?? "";
const count = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;

const reasoning_model = (model: string): boolean => /^(gpt-5|o1|o3|o4)/i.test(model);
const judge_schema = JSON.stringify({
    type: "object",
    properties: {
        score: { type: "integer", enum: [0, 1] },
        label: { type: "string", enum: ["correct", "incorrect"] },
        explanation: { type: "string" },
    },
    required: ["score", "label", "explanation"],
    additionalProperties: false,
});

type process_result = { stdout: string; stderr: string };

const run_process = (command: string, args: string[], input: string, cwd: string, timeout_ms: number): Promise<process_result> => new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, windowsHide: true, shell: false, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const limit = 10 * 1_048_576;
    const timer = setTimeout(() => {
        child.kill();
        reject(new Error(`${command} timed out after ${timeout_ms}ms`));
    }, timeout_ms);
    child.stdout.on("data", (value: Buffer) => {
        stdout += value.toString("utf8");
        if (stdout.length > limit) child.kill();
    });
    child.stderr.on("data", (value: Buffer) => {
        stderr += value.toString("utf8");
        if (stderr.length > limit) child.kill();
    });
    child.once("error", (error) => {
        clearTimeout(timer);
        reject(new Error(`failed to start ${command}: ${error.message}`));
    });
    child.once("close", (code) => {
        clearTimeout(timer);
        if (code === 0) resolve({ stdout, stderr });
        else reject(new Error(`${command} exited ${code}: ${(stderr || stdout).trim().slice(-2_000)}`));
    });
    child.stdin.end(input, "utf8");
});

const prompt_text = (request: model_request): string => [request.system ? `SYSTEM INSTRUCTIONS:\n${request.system}` : "", `USER REQUEST:\n${request.user}`].filter(Boolean).join("\n\n");

const codex_command = (configured?: string): string => {
    if (configured) return configured;
    const local = process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "OpenAI", "Codex", "bin", "codex.exe") : "";
    return local && existsSync(local) ? local : "codex";
};

const command_invocation = (command: string, args: string[]): { command: string; args: string[] } => command.toLowerCase().endsWith(".js")
    ? { command: process.execPath, args: [command, ...args] }
    : { command, args };

const codex_usage = (stdout: string): { prompt_tokens: number | null; completion_tokens: number | null } => {
    for (const line of stdout.split(/\r?\n/).reverse()) {
        try {
            const event = record(JSON.parse(line));
            const usage = record(event.usage ?? record(event.turn).usage);
            const prompt_tokens = count(usage.input_tokens ?? usage.prompt_tokens);
            const completion_tokens = count(usage.output_tokens ?? usage.completion_tokens);
            if (prompt_tokens !== null || completion_tokens !== null) return { prompt_tokens, completion_tokens };
        } catch { }
    }
    return { prompt_tokens: null, completion_tokens: null };
};

export class http_language_model implements language_model {
    readonly provider: model_config["provider"];
    readonly model: string;

    constructor(private readonly config: model_config) {
        this.provider = config.provider;
        this.model = config.model;
    }

    async generate(request: model_request): Promise<model_response> {
        let last_error: unknown;
        for (let attempt = 0; attempt < this.config.max_retries; attempt++) {
            try {
                return await this.call(request);
            } catch (error) {
                last_error = error;
                if (attempt + 1 < this.config.max_retries) await wait(500 * 2 ** attempt);
            }
        }
        throw last_error instanceof Error ? last_error : new Error(String(last_error));
    }

    private call(request: model_request): Promise<model_response> {
        if (this.provider === "ollama") return this.ollama(request);
        if (this.provider === "codex") return this.codex(request);
        if (this.provider === "claude-code") return this.claude_code(request);
        if (this.provider === "anthropic") return this.anthropic(request);
        if (this.provider === "google") return this.google(request);
        return this.openai(request);
    }

    private async fetch_json(url: string, init: RequestInit): Promise<Record<string, unknown>> {
        const response = await fetch(url, { ...init, signal: AbortSignal.timeout(this.config.timeout_ms) });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
            const detail = text(record(payload).error && record(record(payload).error).message, record(payload).message, response.statusText);
            throw new Error(`${this.provider} ${response.status}: ${detail}`);
        }
        return record(payload);
    }

    private async openai(request: model_request): Promise<model_response> {
        const base_url = (this.config.base_url ?? "https://api.openai.com/v1").replace(/\/+$/, "");
        const messages = [
            ...(request.system ? [{ role: "system", content: request.system }] : []),
            { role: "user", content: request.user },
        ];
        const max_tokens = request.max_tokens ?? this.config.max_tokens;
        const body: Record<string, unknown> = {
            model: this.model,
            messages,
            ...(reasoning_model(this.model) ? { max_completion_tokens: max_tokens } : { max_tokens, temperature: request.temperature ?? this.config.temperature }),
            ...(request.json ? { response_format: { type: "json_object" } } : {}),
        };
        const payload = await this.fetch_json(`${base_url}/chat/completions`, {
            method: "POST",
            headers: { authorization: `Bearer ${this.config.api_key}`, "content-type": "application/json" },
            body: JSON.stringify(body),
        });
        const choice = record(array(payload.choices)[0]);
        const usage = record(payload.usage);
        return {
            text: text(record(choice.message).content).trim(),
            prompt_tokens: count(usage.prompt_tokens),
            completion_tokens: count(usage.completion_tokens),
        };
    }

    private async anthropic(request: model_request): Promise<model_response> {
        const base_url = (this.config.base_url ?? "https://api.anthropic.com/v1").replace(/\/+$/, "");
        const payload = await this.fetch_json(`${base_url}/messages`, {
            method: "POST",
            headers: { "x-api-key": this.config.api_key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
            body: JSON.stringify({
                model: this.model,
                ...(request.system ? { system: `${request.system}${request.json ? "\nReturn valid JSON only." : ""}` } : request.json ? { system: "Return valid JSON only." } : {}),
                messages: [{ role: "user", content: request.user }],
                max_tokens: request.max_tokens ?? this.config.max_tokens,
                temperature: request.temperature ?? this.config.temperature,
            }),
        });
        const usage = record(payload.usage);
        return {
            text: text(record(array(payload.content)[0]).text).trim(),
            prompt_tokens: count(usage.input_tokens),
            completion_tokens: count(usage.output_tokens),
        };
    }

    private async google(request: model_request): Promise<model_response> {
        const base_url = (this.config.base_url ?? "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");
        const payload = await this.fetch_json(`${base_url}/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.config.api_key)}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                ...(request.system ? { system_instruction: { parts: [{ text: request.system }] } } : {}),
                contents: [{ role: "user", parts: [{ text: request.user }] }],
                generationConfig: {
                    maxOutputTokens: request.max_tokens ?? this.config.max_tokens,
                    temperature: request.temperature ?? this.config.temperature,
                    ...(request.json ? { responseMimeType: "application/json" } : {}),
                },
            }),
        });
        const candidate = record(array(payload.candidates)[0]);
        const parts = array(record(candidate.content).parts);
        const usage = record(payload.usageMetadata);
        return {
            text: parts.map((part) => text(record(part).text)).join("").trim(),
            prompt_tokens: count(usage.promptTokenCount),
            completion_tokens: count(usage.candidatesTokenCount),
        };
    }

    private async ollama(request: model_request): Promise<model_response> {
        const base_url = (this.config.base_url ?? "http://127.0.0.1:11434").replace(/\/+$/, "");
        const payload = await this.fetch_json(`${base_url}/api/chat`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                model: this.model,
                messages: [
                    ...(request.system ? [{ role: "system", content: request.system }] : []),
                    { role: "user", content: request.user },
                ],
                stream: false,
                think: false,
                ...(request.json ? { format: "json" } : {}),
                options: {
                    temperature: request.temperature ?? this.config.temperature,
                    num_predict: request.max_tokens ?? this.config.max_tokens,
                    seed: 0,
                },
            }),
        });
        return {
            text: text(record(payload.message).content).trim(),
            prompt_tokens: count(payload.prompt_eval_count),
            completion_tokens: count(payload.eval_count),
        };
    }

    private async codex(request: model_request): Promise<model_response> {
        const directory = mkdtempSync(join(tmpdir(), "openmemory-codex-"));
        const output = join(directory, "last-message.txt");
        const schema = join(directory, "schema.json");
        try {
            if (request.json) writeFileSync(schema, judge_schema, "utf8");
            const args = [
                "exec",
                "--ephemeral",
                "--skip-git-repo-check",
                "--ignore-user-config",
                "--ignore-rules",
                "--sandbox", "read-only",
                "--color", "never",
                "--json",
                ...(this.model && this.model !== "default" ? ["--model", this.model] : []),
                ...(request.json ? ["--output-schema", schema] : []),
                "--output-last-message", output,
                "-",
            ];
            const invocation = command_invocation(codex_command(this.config.command), args);
            const process_result = await run_process(invocation.command, invocation.args, prompt_text(request), directory, this.config.timeout_ms);
            if (!existsSync(output)) throw new Error("Codex did not write its final response");
            const result = readFileSync(output, "utf8").trim();
            const usage = codex_usage(process_result.stdout);
            return {
                text: result,
                prompt_tokens: usage.prompt_tokens,
                completion_tokens: usage.completion_tokens ?? (result ? Math.ceil(result.length / 4) : 0),
            };
        } finally {
            rmSync(directory, { recursive: true, force: true });
        }
    }

    private async claude_code(request: model_request): Promise<model_response> {
        const directory = mkdtempSync(join(tmpdir(), "openmemory-claude-"));
        try {
            const args = [
                "-p",
                "--output-format", "json",
                "--no-session-persistence",
                "--safe-mode",
                "--permission-mode", "dontAsk",
                "--tools", "",
                ...(request.system ? ["--system-prompt", request.system] : []),
                ...(this.model && this.model !== "default" ? ["--model", this.model] : []),
                ...(request.json ? ["--json-schema", judge_schema] : []),
            ];
            const invocation = command_invocation(this.config.command ?? "claude", args);
            const result = await run_process(invocation.command, invocation.args, request.user, directory, this.config.timeout_ms);
            const payload = record(JSON.parse(result.stdout));
            const usage = record(payload.usage);
            const structured = payload.structured_output;
            const input_tokens = [usage.input_tokens, usage.cache_creation_input_tokens, usage.cache_read_input_tokens]
                .reduce<number>((sum, value) => sum + (typeof value === "number" ? value : 0), 0);
            return {
                text: structured && typeof structured === "object" ? JSON.stringify(structured) : text(payload.result).trim(),
                prompt_tokens: input_tokens || null,
                completion_tokens: count(usage.output_tokens),
            };
        } finally {
            rmSync(directory, { recursive: true, force: true });
        }
    }
}

export const create_language_model = (config: model_config): language_model => new http_language_model(config);
