import type { BenchmarkRecord, LlmJudge, LlmJudgeResult } from "./types";

export interface CreateLlmJudgeOptions {
  provider?: "openai" | "gemini" | "siray";
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  fetcher?: typeof fetch;
}

export function createLlmJudge(
  options: CreateLlmJudgeOptions = {},
): LlmJudge {
  const provider =
    options.provider ??
    (process.env.OM_BENCHMARK_LLM_PROVIDER as CreateLlmJudgeOptions["provider"]) ??
    "openai";
  const apiKey =
    options.apiKey ??
    process.env.OM_BENCHMARK_LLM_API_KEY ??
    providerApiKey(provider) ??
    process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "LLM judge requires OM_BENCHMARK_LLM_API_KEY or OPENAI_API_KEY",
    );
  }

  const baseUrl =
    options.baseUrl ??
    process.env.OM_BENCHMARK_LLM_BASE_URL ??
    defaultBaseUrl(provider);
  const model =
    options.model ?? process.env.OM_BENCHMARK_LLM_MODEL ?? defaultModel(provider);
  const fetcher = options.fetcher ?? fetch;

  return async (record: BenchmarkRecord) => {
    if (provider === "gemini") {
      return judgeWithGemini({ apiKey, baseUrl, model, fetcher, record });
    }
    return judgeWithOpenAiCompatible({ apiKey, baseUrl, model, fetcher, record });
  };
}

async function judgeWithOpenAiCompatible(options: {
  apiKey: string;
  baseUrl: string;
  model: string;
  fetcher: typeof fetch;
  record: BenchmarkRecord;
}): Promise<LlmJudgeResult> {
    const response = await options.fetcher(`${options.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${options.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: options.model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a strict memory benchmark judge. Return JSON only with score, label, and rationale. Score 1 for fully correct, 0.5 for partially correct, 0 for incorrect. Reward correct abstention when the expected answer says unknown or unanswerable.",
          },
          {
            role: "user",
            content: JSON.stringify(recordPayload(options.record)),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM judge failed: ${response.status}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return parseOpenAiJudgePayload(payload);
}

async function judgeWithGemini(options: {
  apiKey: string;
  baseUrl: string;
  model: string;
  fetcher: typeof fetch;
  record: BenchmarkRecord;
}): Promise<LlmJudgeResult> {
  const url = `${options.baseUrl.replace(/\/$/, "")}/models/${options.model}:generateContent?key=${encodeURIComponent(options.apiKey)}`;
  const response = await options.fetcher(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${judgeInstruction()}\n${JSON.stringify(recordPayload(options.record))}`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini LLM judge failed: ${response.status}`);
  }
  return parseGeminiJudgePayload(await response.json());
}

function parseOpenAiJudgePayload(payload: unknown): LlmJudgeResult {
  const content =
    (payload as { choices?: Array<{ message?: { content?: string } }> })
      .choices?.[0]?.message?.content ?? "{}";
  return parseJudgeJson(content);
}

function parseGeminiJudgePayload(payload: unknown): LlmJudgeResult {
  const content =
    (payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
      .candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  return parseJudgeJson(content);
}

function parseJudgeJson(content: string): LlmJudgeResult {
  const parsed = JSON.parse(content) as Partial<LlmJudgeResult>;
  const score = clamp(Number(parsed.score ?? 0), 0, 1);

  return {
    score,
    label: parsed.label ?? labelFromScore(score),
    rationale: parsed.rationale,
    raw: parsed,
  };
}

function judgeInstruction(): string {
  return "You are a strict memory benchmark judge. Return JSON only with score, label, and rationale. Score 1 for fully correct, 0.5 for partially correct, 0 for incorrect. Reward correct abstention when the expected answer says unknown or unanswerable.";
}

function recordPayload(record: BenchmarkRecord) {
  return {
    benchmark_id: record.benchmark_id,
    question: record.question,
    expected_answers: record.expected_answers,
    predicted_answer: record.predicted_answer,
    query_type: record.query_type,
    source: record.source,
  };
}

function providerApiKey(provider?: CreateLlmJudgeOptions["provider"]): string | undefined {
  if (provider === "gemini") {
    return process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  }
  if (provider === "siray") {
    return process.env.SIRAY_API_KEY;
  }
  return undefined;
}

function defaultBaseUrl(provider?: CreateLlmJudgeOptions["provider"]): string {
  if (provider === "gemini") {
    return "https://generativelanguage.googleapis.com/v1beta";
  }
  if (provider === "siray") {
    return "https://api.siray.ai/v1";
  }
  return "https://api.openai.com/v1";
}

function defaultModel(provider?: CreateLlmJudgeOptions["provider"]): string {
  if (provider === "gemini") {
    return "gemini-2.0-flash";
  }
  if (provider === "siray") {
    return "gpt-5.2-chat";
  }
  return "gpt-4o-mini";
}

function labelFromScore(score: number): LlmJudgeResult["label"] {
  if (score >= 0.99) {
    return "correct";
  }
  if (score > 0) {
    return "partially_correct";
  }
  return "incorrect";
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}
