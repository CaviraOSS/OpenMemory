// Force synthetic embeddings + sqlite backend BEFORE importing anything
// that loads cfg/db. vitest.config.ts already sets these via env, but keep
// this guard for standalone tsx runs.
process.env.OM_EMBEDDINGS = "synthetic";
process.env.OM_EMBEDDING_FALLBACK = "synthetic";
process.env.OM_METADATA_BACKEND = process.env.OM_METADATA_BACKEND || "sqlite";
process.env.OM_VECTOR_BACKEND = process.env.OM_VECTOR_BACKEND || "sqlite";

import { beforeEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { create_mcp_srv } from "../src/ai/mcp";
import { run_async, q } from "../src/core/db";

const T_ALICE = "tenant-alice-mcp";
const T_BOB = "tenant-bob-mcp";

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

function parse_items(result: any): Array<{ id: string; user_id?: string }> {
    // openmemory_list returns two text blocks; the second is a JSON dump.
    const blocks = (result?.content ?? []) as Array<{
        type: string;
        text: string;
    }>;
    const jsonBlock = blocks
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .find((t) => t.trim().startsWith("{"));
    if (!jsonBlock) return [];
    const parsed = JSON.parse(jsonBlock);
    return parsed.items ?? [];
}

function parse_store(result: any): { id?: string; project_id?: string } {
    const blocks = (result?.content ?? []) as Array<{
        type: string;
        text: string;
    }>;
    const jsonBlock = blocks
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .find((t) => t.trim().startsWith("{"));
    if (!jsonBlock) return {};
    const parsed = JSON.parse(jsonBlock);
    return { id: parsed?.hsg?.id, project_id: parsed?.project_id };
}

describe("MCP per-tenant scoping", () => {
    beforeEach(async () => {
        await cleanup();
    });

    it("openmemory_store binds writes to the authenticated tenant", async () => {
        const { client } = await connect_client(T_ALICE);
        const stored = await client.callTool({
            name: "openmemory_store",
            arguments: {
                content:
                    "Nginx 502 on a fresh VM: check that the upstream service is actually running before looking at nginx config.",
                tags: ["nginx", "sysadmin"],
            },
        });
        const { id } = parse_store(stored);
        expect(id).toBeTruthy();

        // The DB row must carry the tenant as user_id — without this fix
        // it would have been "anonymous" and invisible to REST /memory/all.
        const row = await q.get_mem.get(id!);
        expect(row).toBeTruthy();
        expect(row.user_id).toBe(T_ALICE);
        expect(row.project_id).toBe("system_global");
    });

    it("openmemory_list returns the tenant's own MCP-stored memories (regression)", async () => {
        // Reproduces the symptom from the bug report: a memory stored via
        // MCP openmemory_store must appear in MCP openmemory_list on the
        // same authenticated session.
        const { client } = await connect_client(T_ALICE);

        await client.callTool({
            name: "openmemory_store",
            arguments: {
                content:
                    "Nginx 502 on a fresh VM: check the upstream service is running before touching nginx config.",
                tags: ["nginx"],
            },
        });

        const listed = await client.callTool({
            name: "openmemory_list",
            arguments: { limit: 50 },
        });
        const items = parse_items(listed);
        expect(items.length).toBeGreaterThan(0);
        expect(items.every((i) => i.user_id === T_ALICE)).toBe(true);
    });

    it("openmemory_list isolates tenants from each other", async () => {
        const alice = await connect_client(T_ALICE);
        const bob = await connect_client(T_BOB);

        await alice.client.callTool({
            name: "openmemory_store",
            arguments: { content: "Alice's private dev notes about nginx." },
        });
        await bob.client.callTool({
            name: "openmemory_store",
            arguments: { content: "Bob's private dev notes about postgres." },
        });

        const bob_list = parse_items(
            await bob.client.callTool({
                name: "openmemory_list",
                arguments: { limit: 50 },
            }),
        );
        // Bob must not see Alice's memories.
        expect(bob_list.every((i) => i.user_id === T_BOB)).toBe(true);
        expect(bob_list.length).toBe(1);

        const alice_list = parse_items(
            await alice.client.callTool({
                name: "openmemory_list",
                arguments: { limit: 50 },
            }),
        );
        expect(alice_list.every((i) => i.user_id === T_ALICE)).toBe(true);
        expect(alice_list.length).toBe(1);
    });

    it("openmemory_store rejects a user_id arg that disagrees with the tenant", async () => {
        const { client } = await connect_client(T_ALICE);
        const result: any = await client.callTool({
            name: "openmemory_store",
            arguments: {
                content: "attempt to forge another tenant's identity",
                user_id: T_BOB,
            },
        });
        // ToolRegistry catches errors and turns them into an isError result
        // with a textual "Error: ..." block.
        expect(result.isError).toBe(true);
        const text = (result.content ?? [])
            .map((b: any) => b.text ?? "")
            .join("\n");
        expect(text).toMatch(/tenant_mismatch/);
    });

    it("stdio-style server (no tenant) preserves legacy behaviour", async () => {
        // No tenant bound — this is the stdio MCP shape. Stored memories
        // get the "anonymous" fallback from add_hsg_memory and openmemory_list
        // returns everything in the table (the pre-existing local-dev contract).
        const { client } = await connect_client(undefined);
        const stored = await client.callTool({
            name: "openmemory_store",
            arguments: { content: "stdio-mode memory with no tenant binding" },
        });
        const { id } = parse_store(stored);
        expect(id).toBeTruthy();

        const row = await q.get_mem.get(id!);
        expect(row.user_id).toBe("anonymous");

        const items = parse_items(
            await client.callTool({
                name: "openmemory_list",
                arguments: { limit: 50 },
            }),
        );
        expect(items.length).toBe(1);
        expect(items[0].id).toBe(id);
    });
});
