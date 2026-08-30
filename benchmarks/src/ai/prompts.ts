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
 *  file  : benchmarks/src/ai/prompts.ts
 *  usage : supports LongMemory benchmark prompts
 */

import type { benchmark_case, search_hit } from "../types";

const context_lines = (hits: search_hit[]): string => hits.length ? hits.map((hit, index) => {
    const timestamp = typeof hit.metadata.timestamp === "string" ? hit.metadata.timestamp : typeof hit.metadata.created_at === "string" ? hit.metadata.created_at : "unknown date";
    return `[${index + 1}] (${timestamp}) ${hit.text}`;
}).join("\n") : "(no memories retrieved)";

export function build_answer_prompt(item: benchmark_case, hits: search_hit[]): { system: string; user: string } {
    const category = item.category.toLowerCase();
    const preference = category.includes("preference");
    const open_domain = category.includes("open-domain");
    const adversarial = category.includes("adversarial") || category.includes("abstention");
    const category_guidance = [
        adversarial ? "Verify that the requested person is the speaker or subject of the claimed reaction. A question asked by one person does not establish that person's own reaction." : "",
    ].filter(Boolean).join(" ");
    const system = preference
        ? `You answer personalization questions using retrieved memories as the source of user preferences. Read every memory, verify entity attribution, and give a concise helpful recommendation tailored to those preferences. You may use general knowledge to formulate recommendations, but never invent or contradict a user preference. If no relevant preference is present, answer exactly: I don't know. Give only the final answer without hidden reasoning.`
        : open_domain
            ? `You answer open-domain questions by grounding personal premises in retrieved memories, then using ordinary general knowledge for the requested inference. State only the concise inferred answer; do not invent personal facts absent from memory. If the personal premises are missing, answer exactly: I don't know. ${category_guidance} Give only the final answer without hidden reasoning.`
            : `You answer questions using only retrieved memories. Read every memory, verify entity attribution, combine facts across memories, and prefer specific current information over older information. Resolve relative dates from each memory's timestamp. ${category_guidance} If the memories do not contain enough information, answer exactly: I don't know. Give only a concise final answer without hidden reasoning.`;
    const user = `Question category: ${item.category}
Question date: ${item.question_date ?? "not specified"}

Retrieved memories:
${context_lines(hits)}

Question: ${item.question}
Answer:`;
    return { system, user };
}

const default_rules = `The hypothesis is correct when it contains the ground-truth answer or an equivalent paraphrase. It may include extra accurate detail. It is incorrect when required information is missing, contradicted, or about a different subject.`;
const abstention_rules = `This is an abstention question. The hypothesis is correct only when it says it does not know, expresses uncertainty, or says the information is unavailable. It is incorrect if it invents a specific answer.`;
const temporal_rules = `${default_rules} Do not penalize a one-day difference or an equivalent relative date when the underlying event and time are correct.`;
const update_rules = `${default_rules} The latest value must be present. Mentioning an older value is allowed only when the current answer remains unambiguous.`;
const preference_rules = `The ground truth may be a personalization rubric. The hypothesis is correct when it recalls and correctly uses at least one relevant personal preference without inventing conflicting preferences.`;
const contradiction_rules = `This is a contradiction-resolution question. The hypothesis is correct only when it notices the conflicting information and reconciles or flags it instead of silently choosing one side. It is incorrect when it presents one side as settled fact or invents new facts.`;
const ordering_rules = `${default_rules} The relative order or timing of events must be preserved; an answer that lists the right events in the wrong order is incorrect.`;

export function judge_rules(category: string): string {
    const normalized = category.toLowerCase();
    if (normalized.includes("abstention") || normalized.includes("adversarial")) return abstention_rules;
    if (normalized.includes("contradiction")) return contradiction_rules;
    if (normalized.includes("event-order")) return ordering_rules;
    if (normalized.includes("temporal")) return temporal_rules;
    if (normalized.includes("update") || normalized.includes("changing")) return update_rules;
    if (normalized.includes("preference")) return preference_rules;
    return default_rules;
}

export function build_judge_prompt(input: { question: string; category: string; ground_truth: string; hypothesis: string; evidence: string[] }): { system: string; user: string } {
    return {
        system: `You are an impartial evaluator of conversational memory answers. Return one JSON object only with keys score, label, and explanation. score must be 1 or 0. label must be correct or incorrect.`,
        user: `${judge_rules(input.category)} Evidence may clarify ambiguity or reveal an incorrect gold answer, but it is not a substitute for the hypothesis: mark correct only when the hypothesis itself answers the question.

Question: ${input.question}
Ground truth or rubric: ${input.ground_truth}
System hypothesis: ${input.hypothesis}
Evidence messages:
${input.evidence.length ? input.evidence.map((value, index) => `[${index + 1}] ${value}`).join("\n") : "(none supplied)"}

Return: {"score":1,"label":"correct","explanation":"one sentence"}`,
    };
}
