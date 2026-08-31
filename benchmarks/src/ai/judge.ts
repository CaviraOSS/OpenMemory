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
 *  file  : benchmarks/src/ai/judge.ts
 *  usage : supports LongMemory benchmark judge
 */


import { build_judge_prompt } from "./prompts";
import type { ai_judge, judge_input, judge_result, language_model } from "../types";

const extract_json = (value: string): Record<string, unknown> => {
    const match = value.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("judge response did not contain JSON");
    return JSON.parse(match[0]) as Record<string, unknown>;
};

export function parse_judge_response(raw: string): judge_result {
    try {
        const parsed = extract_json(raw);
        const score = parsed.score === 1 || String(parsed.label).toLowerCase() === "correct" ? 1 : 0;
        return {
            score,
            label: score ? "correct" : "incorrect",
            explanation: typeof parsed.explanation === "string" ? parsed.explanation : typeof parsed.reasoning === "string" ? parsed.reasoning : "",
            raw,
        };
    } catch {
        const verdicts = raw.toLowerCase().match(/\b(correct|incorrect|yes|no|pass|fail)\b/g) ?? [];
        const verdict = verdicts.at(-1);
        const score = verdict === "correct" || verdict === "yes" || verdict === "pass" ? 1 : 0;
        return { score, label: score ? "correct" : "incorrect", explanation: "judge response required fallback parsing", raw };
    }
}

export class model_judge implements ai_judge {
    readonly name: string;
    readonly model: string;

    constructor(private readonly client: language_model) {
        this.name = client.provider;
        this.model = client.model;
    }

    async evaluate(input: judge_input): Promise<judge_result> {
        const prompt = build_judge_prompt(input);
        const response = await this.client.generate({ system: prompt.system, user: prompt.user, json: true, temperature: 0 });
        return parse_judge_response(response.text);
    }
}

export const create_judge = (client: language_model): ai_judge => new model_judge(client);
