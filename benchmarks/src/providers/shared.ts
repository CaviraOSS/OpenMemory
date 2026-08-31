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
 *  file  : benchmarks/src/providers/shared.ts
 *  usage : supports LongMemory benchmark shared
 */


import { http_error } from "./http";
import type { search_hit } from "../types";

export const record = (value: unknown): Record<string, unknown> => typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
export const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
export const text = (...values: unknown[]): string => values.find((value) => typeof value === "string") as string | undefined ?? "";
export const number = (...values: unknown[]): number | undefined => values.find((value) => typeof value === "number" && Number.isFinite(value)) as number | undefined;
export const unwrap = (value: unknown): unknown => record(value).data ?? value;
export const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const provider_metadata_keys = new Set(["dataset", "session", "session_id", "role", "speaker"]);

export const provider_metadata = (metadata: Record<string, unknown>): Record<string, unknown> => Object.fromEntries(
    Object.entries(metadata).filter(([key]) => provider_metadata_keys.has(key)),
);

export const attributed_text = (event: { text: string; metadata: Record<string, unknown> }): string => {
    const speaker = text(event.metadata.role, event.metadata.speaker);
    return speaker ? `${speaker}: ${event.text}` : event.text;
};

export const scope_key = (value: string): string => value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 96);

export const route = (template: string, values: Record<string, string | number>): string => Object.entries(values).reduce(
    (path, [key, value]) => path.replaceAll(`:${key}`, encodeURIComponent(String(value))),
    template,
);

export async function ignore_missing(operation: () => Promise<unknown>): Promise<void> {
    try { await operation(); }
    catch (error) { if (!(error instanceof http_error) || error.status !== 404) throw error; }
}

export function as_hits(value: unknown): search_hit[] {
    const root = record(unwrap(value));
    const values = Array.isArray(value) ? value : array(root.results ?? root.items ?? root.facts ?? root.memories ?? root.chunks ?? root.episodes ?? root.edges ?? root.nodes);
    return values.map((raw) => {
        if (typeof raw === "string") return { text: raw, metadata: { raw } };
        const item = record(raw);
        const node = record(item.node);
        const payload = record(item.payload);
        const result = record(item.search_result);
        const content = record(node.content);
        const metadata = record(item.metadata ?? node.metadata ?? payload.metadata);
        const id = text(item.id, item.uuid, item.memory_id, node.id) || undefined;
        const hit_text = text(item.memory, item.chunk, item.fact, item.text, item.content, item.summary, item.search_result, result.text, result.content, result.chunk, content.raw, payload.text, payload.content);
        const score = number(item.score, item.similarity, item.relevance, item.distance);
        const created_at = text(item.created_at, item.timestamp, metadata.created_at, metadata.timestamp);
        return {
            ...(id ? { id } : {}),
            text: hit_text,
            ...(score !== undefined ? { score } : {}),
            metadata: { ...metadata, ...(created_at ? { created_at } : {}), raw },
        };
    }).filter((hit) => hit.text.length > 0);
}
