process.env.OM_EMBEDDINGS = "synthetic";
process.env.OM_EMBEDDING_FALLBACK = "synthetic";
process.env.OM_METADATA_BACKEND = process.env.OM_METADATA_BACKEND || "sqlite";
process.env.OM_VECTOR_BACKEND = process.env.OM_VECTOR_BACKEND || "sqlite";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

const { hsg_hook } = vi.hoisted(() => ({
    hsg_hook: {
        impl: null as null | ((...args: any[]) => Promise<any>),
    },
}));

vi.mock("../src/memory/hsg", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../src/memory/hsg")>();
    return {
        ...actual,
        hsg_query: (...args: any[]) =>
            hsg_hook.impl
                ? hsg_hook.impl(...args)
                : actual.hsg_query(...(args as [string, number?, any?])),
    };
});

import { create_mcp_srv } from "../src/ai/mcp";
import { run_async } from "../src/core/db";
import { insert_fact } from "../src/temporal_graph/store";
import { query_facts_at_time } from "../src/temporal_graph/query";

const TENANT = "tenant-query-failsoft";

async function cleanup() {
    await run_async(`DELETE FROM memories`);
    try {
        await run_async(`DELETE FROM vectors`);
    } catch {
        /* schema variant */
    }
    try {
        await run_async(`DELETE FROM openmemory_vectors`);
    } catch {
        /* schema variant */
    }
    try {
        await run_async(`DELETE FROM waypoints`);
    } catch {
        /* schema variant */
    }
    try {
        await run_async(`DELETE FROM temporal_facts WHERE user_id IN (?, ?)`, [
            TENANT,
            "anonymous",
        ]);
    } catch {
        /* schema variant */
    }
}

async function connect_client(tenant?: string) {
    const srv = create_mcp_srv(tenant);
    const [client_transport, server_transport] =
        InMemoryTransport.createLinkedPair();
    await srv.connect(server_transport);
    const client = new Client({ name: "test-client", version: "0.0.0" });
    await client.connect(client_transport);
    return { client, srv };
}

function parse_json_block(result: any): any {
    const blocks = (result?.content ?? []) as Array<{
        type: string;
        text: string;
    }>;
    const jsonBlock = blocks
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .find((t) => t.trim().startsWith("{") || t.trim().startsWith("["));
    if (!jsonBlock) return null;
    return JSON.parse(jsonBlock);
}

function result_text(result: any): string {
    return ((result?.content ?? []) as Array<{ text?: string }>)
        .map((b) => b.text ?? "")
        .join("\n");
}

describe("MCP openmemory_query fail-soft", () => {
    beforeEach(async () => {
        hsg_hook.impl = null;
        delete process.env.OM_MCP_QUERY_TIMEOUT_MS;
        await cleanup();
    });

    afterEach(() => {
        hsg_hook.impl = null;
        delete process.env.OM_MCP_QUERY_TIMEOUT_MS;
    });

    it("default contextual query returns a tool result, not a transport drop", async () => {
        const { client } = await connect_client(TENANT);
        await client.callTool({
            name: "openmemory_store",
            arguments: {
                content:
                    "Nginx 502 on a fresh VM: check that the upstream service is actually running.",
            },
        });
        const result: any = await client.callTool({
            name: "openmemory_query",
            arguments: { query: "nginx 502 upstream" },
        });
        expect(result.isError).toBeFalsy();
        const payload = parse_json_block(result);
        expect(payload.type).toBe("contextual");
        expect(Array.isArray(payload.contextual)).toBe(true);
        expect(payload.contextual.length).toBeGreaterThan(0);
    });

    it("failed HSG query returns isError with a readable message", async () => {
        hsg_hook.impl = async () => {
            throw new Error("embed provider unavailable");
        };
        const { client } = await connect_client(TENANT);
        const result: any = await client.callTool({
            name: "openmemory_query",
            arguments: { query: "anything" },
        });
        expect(result.isError).toBe(true);
        const text = result_text(result);
        expect(text).toMatch(/openmemory_query failed/);
        expect(text).toMatch(/embed provider unavailable/);
    });

    it("timed-out HSG query returns a tool error instead of hanging the session", async () => {
        process.env.OM_MCP_QUERY_TIMEOUT_MS = "80";
        hsg_hook.impl = () => new Promise(() => {});
        const { client } = await connect_client(TENANT);
        const started = Date.now();
        const result: any = await client.callTool({
            name: "openmemory_query",
            arguments: { query: "hang please" },
        });
        const elapsed = Date.now() - started;
        expect(elapsed).toBeLessThan(5_000);
        expect(result.isError).toBe(true);
        expect(result_text(result)).toMatch(/timed out/);
    });

    it("unified query fail-softs HSG and still returns facts", async () => {
        hsg_hook.impl = async () => {
            throw new Error("vector search exploded");
        };
        await insert_fact({
            subject: "nginx",
            predicate: "listens_on",
            object: "80",
            user_id: TENANT,
            confidence: 1,
        });
        const { client } = await connect_client(TENANT);
        const result: any = await client.callTool({
            name: "openmemory_query",
            arguments: {
                query: "nginx port",
                type: "unified",
                fact_pattern: { subject: "nginx" },
            },
        });
        expect(result.isError).toBeFalsy();
        const payload = parse_json_block(result);
        expect(payload.contextual).toEqual([]);
        expect(payload.contextual_error).toMatch(/vector search exploded/);
        expect(payload.factual.length).toBeGreaterThan(0);
        expect(result_text(result)).toMatch(
            /Warning: contextual search failed/,
        );
    });

    it("factual query without fact_pattern is capped at k", async () => {
        for (let i = 0; i < 20; i++) {
            await insert_fact({
                subject: `svc-${i}`,
                predicate: "runs",
                object: `box-${i}`,
                user_id: TENANT,
                confidence: 1,
            });
        }
        const uncapped = await query_facts_at_time({
            user_id: TENANT,
            min_confidence: 0.0,
        });
        expect(uncapped.length).toBeGreaterThan(8);

        const capped = await query_facts_at_time({
            user_id: TENANT,
            min_confidence: 0.0,
            limit: 8,
        });
        expect(capped.length).toBe(8);

        const { client } = await connect_client(TENANT);
        const result: any = await client.callTool({
            name: "openmemory_query",
            arguments: {
                query: "inventory",
                type: "factual",
                k: 5,
            },
        });
        expect(result.isError).toBeFalsy();
        const payload = parse_json_block(result);
        expect(payload.factual.length).toBeLessThanOrEqual(5);
        expect(payload.factual_capped).toBe(5);
        expect(result_text(result)).toMatch(/capped at k=5/);
    });

    it("factual query with fact_pattern still matches", async () => {
        await insert_fact({
            subject: "postgres",
            predicate: "listens_on",
            object: "5432",
            user_id: TENANT,
            confidence: 1,
        });
        const { client } = await connect_client(TENANT);
        const result: any = await client.callTool({
            name: "openmemory_query",
            arguments: {
                query: "postgres port",
                type: "factual",
                fact_pattern: { subject: "postgres" },
            },
        });
        expect(result.isError).toBeFalsy();
        const payload = parse_json_block(result);
        expect(payload.factual.some((f: any) => f.object === "5432")).toBe(
            true,
        );
        expect(payload.factual_capped).toBeUndefined();
    });

    it("list/get/store/delete keep working alongside query fail-soft", async () => {
        const { client } = await connect_client(TENANT);
        const stored: any = await client.callTool({
            name: "openmemory_store",
            arguments: { content: "keep-alive memory about redis persistence" },
        });
        const stored_json = parse_json_block(stored);
        const id = stored_json?.hsg?.id;
        expect(id).toBeTruthy();

        const listed: any = await client.callTool({
            name: "openmemory_list",
            arguments: { limit: 10 },
        });
        expect(listed.isError).toBeFalsy();
        expect(parse_json_block(listed).items.length).toBeGreaterThan(0);

        const got: any = await client.callTool({
            name: "openmemory_get",
            arguments: { id },
        });
        expect(got.isError).toBeFalsy();
        expect(result_text(got)).toMatch(/redis persistence/);

        const deleted: any = await client.callTool({
            name: "openmemory_delete",
            arguments: { id },
        });
        expect(deleted.isError).toBeFalsy();
        expect(result_text(deleted)).toMatch(/successfully deleted/);
    });
});
