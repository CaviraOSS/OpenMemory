import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cognee_provider, graphiti_provider, mem0_provider, openmemory_provider, supermemory_provider } from "../src/providers";
import { provider_config_from_env } from "../src/config";
import type { benchmark_event, benchmark_provider, benchmark_scope } from "../src/types";

type request_record = { method: string; path: string; headers: IncomingMessage["headers"]; body: string };
const close_servers: Array<() => Promise<void>> = [];

async function start_server(handler: (request: request_record, response: ServerResponse) => void): Promise<string> {
    const server = createServer(async (request, response) => {
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(Buffer.from(chunk));
        handler({ method: request.method ?? "GET", path: request.url ?? "/", headers: request.headers, body: Buffer.concat(chunks).toString("utf8") }, response);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server failed to bind");
    close_servers.push(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
    return `http://127.0.0.1:${address.port}`;
}

const respond = (response: ServerResponse, payload: unknown, status = 200): void => {
    response.statusCode = status;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(payload));
};

const scope: benchmark_scope = { run_id: "run", case_id: "case", corpus_id: "case", user_id: "user" };
const events: benchmark_event[] = [{ id: "evidence", text: "My dentist is Dr. Lin", timestamp: Date.UTC(2026, 0, 1), metadata: { source_event_id: "evidence" } }];

afterEach(async () => {
    vi.unstubAllEnvs();
    await Promise.all(close_servers.splice(0).map((close) => close()));
});

async function lifecycle(provider: benchmark_provider): Promise<void> {
    await provider.health();
    await provider.reset(scope);
    const result = await provider.ingest(events, scope);
    await provider.await_indexing(result, scope);
    const hits = await provider.search("Who is my dentist?", 5, scope);
    expect(hits[0]?.text.toLowerCase()).toContain("dr. lin");
    await provider.close();
}

describe("provider contracts", () => {
    it("configures hosted Supermemory API from the standard key", () => {
        expect(provider_config_from_env("supermemory", { SUPERMEMORY_API_KEY: "sm_test" })).toMatchObject({
            base_url: "https://api.supermemory.ai",
            api_key: "sm_test",
        });
        expect(provider_config_from_env("supermemory", { SUPERMEMORY_API_KEY: "standard", BENCH_SUPERMEMORY_API_KEY: "benchmark" }).api_key).toBe("benchmark");
    });

    it("configures the OpenMemory embedding batch size", () => {
        expect(provider_config_from_env("openmemory", { BENCH_OPENMEMORY_EMBEDDING_BATCH_SIZE: "64" }).embedding_batch_size).toBe(64);
    });

    it("configures Mem0 Platform and Zep Cloud from standard keys", () => {
        expect(provider_config_from_env("mem0", { MEM0_API_KEY: "mem0_test" })).toMatchObject({
            base_url: "https://api.mem0.ai",
            api_key: "mem0_test",
            profile: "cloud",
        });
        expect(provider_config_from_env("graphiti", { ZEP_API_KEY: "zep_test" })).toMatchObject({
            base_url: "https://api.getzep.com/api/v2",
            api_key: "zep_test",
            profile: "cloud",
        });
        expect(provider_config_from_env("mem0", { MEM0_API_KEY: "standard", BENCH_MEM0_API_KEY: "benchmark" }).api_key).toBe("benchmark");
        expect(provider_config_from_env("graphiti", { ZEP_API_KEY: "standard", BENCH_GRAPHITI_API_KEY: "benchmark" }).api_key).toBe("benchmark");
        expect(provider_config_from_env("mem0", { MEM0_API_KEY: "standard", BENCH_MEM0_API_KEY: "" }).api_key).toBe("standard");
    });

    it("uses the real embedded openmemory engine", async () => {
        const provider = new openmemory_provider();
        await provider.initialize({ base_url: "embedded://openmemory" });
        await lifecycle(provider);
    });

    it("rejects semantic embedding fallback in official provider mode", async () => {
        const url = await start_server((_request, response) => respond(response, { error: "unavailable" }, 503));
        vi.stubEnv("OPENMEMORY_EMBEDDING_PROVIDER", "local");
        vi.stubEnv("OPENMEMORY_EMBEDDING_TIER", "deep");
        vi.stubEnv("OPENMEMORY_EMBEDDING_DIMENSION", "8");
        vi.stubEnv("OPENMEMORY_LOCAL_EMBEDDING_URL", `${url}/embed`);
        vi.stubEnv("OPENMEMORY_EMBEDDING_FALLBACK", "synthetic");
        vi.stubEnv("OPENMEMORY_EMBEDDING_MAX_RETRIES", "0");
        const provider = new openmemory_provider();
        await provider.initialize({ base_url: "embedded://openmemory", profile: "semantic" });
        await expect(provider.ingest(events, scope)).rejects.toThrow("semantic embedding fallback is not valid");
        await provider.close();
    });

    it("returns derived OpenMemory facets instead of exact raw turns", async () => {
        const provider = new openmemory_provider();
        await provider.initialize({ base_url: "embedded://openmemory" });
        await provider.reset(scope);
        await provider.ingest([{ id: "procedure", text: "First deploy the API, then verify health, finally monitor errors", timestamp: Date.UTC(2026, 0, 1), metadata: { dataset: "smoke" } }], scope);
        const hits = await provider.search("How should the API be deployed?", 5, scope);
        expect(hits[0]?.text.toLowerCase()).toContain("first deploy the api");
        expect(hits[0]?.text).not.toBe("First deploy the API, then verify health, finally monitor errors");
        await provider.close();
    });

    it("uses authenticated Mem0 Platform API and polls event indexing", async () => {
        const requests: request_record[] = [];
        const url = await start_server((request, response) => {
            requests.push(request);
            if (request.path === "/v1/ping/") return respond(response, { status: "ok" });
            if (request.method === "DELETE") return respond(response, { message: "deleted" });
            if (request.path === "/v3/memories/add/") return respond(response, { event_id: "event" });
            if (request.path === "/v1/event/event/") return respond(response, { status: "SUCCEEDED" });
            if (request.path === "/v3/memories/search/") return respond(response, { results: [{ memory: events[0].text, metadata: { source_event_id: "evidence" } }] });
            return respond(response, {}, 404);
        });
        const provider = new mem0_provider();
        await provider.initialize({ base_url: url, api_key: "mem0_test", timeout_ms: 2_000 });
        await lifecycle(provider);
        expect(requests.every((request) => request.headers.authorization === "Token mem0_test")).toBe(true);
        expect(requests.some((request) => request.path.startsWith("/v1/memories/?user_id=omb_run_case"))).toBe(true);
        expect(requests.find((request) => request.path === "/v3/memories/add/")!.body).not.toContain("source_event_id");
        expect(requests.find((request) => request.path === "/v3/memories/add/")!.body).toContain("source_ref");
        expect(JSON.parse(requests.find((request) => request.path === "/v3/memories/search/")!.body)).toMatchObject({
            filters: { user_id: "omb_run_case" },
            top_k: 5,
        });
        await expect(new mem0_provider().initialize({ base_url: url })).rejects.toThrow("MEM0_API_KEY");
    });

    it("retains the explicit Mem0 OSS profile", async () => {
        const url = await start_server((request, response) => {
            if (request.path === "/api/health") return respond(response, { ok: true });
            if (request.method === "DELETE") return respond(response, {}, 404);
            if (request.path === "/memories") return respond(response, { results: [{ id: "memory" }] });
            if (request.path === "/search") return respond(response, { results: [{ memory: events[0].text, metadata: { source_event_id: "evidence" } }] });
            return respond(response, {}, 404);
        });
        const provider = new mem0_provider();
        await provider.initialize({ base_url: url, profile: "oss" });
        await lifecycle(provider);
    });

    it("uses authenticated Supermemory API and polls document indexing", async () => {
        const requests: request_record[] = [];
        const url = await start_server((request, response) => {
            requests.push(request);
            if (request.path === "/v3/container-tags/list") return respond(response, { containerTags: [] });
            if (request.method === "DELETE") return respond(response, {}, 404);
            if (request.path === "/v3/documents" && request.method === "POST") return respond(response, { id: "doc" });
            if (request.path === "/v3/documents/doc") return respond(response, { status: "done" });
            if (request.path === "/v4/search") return respond(response, { results: [{ chunk: events[0].text, metadata: { source_event_id: "evidence" } }] });
            return respond(response, {}, 404);
        });
        const provider = new supermemory_provider();
        await provider.initialize({ base_url: url, api_key: "sm_test", timeout_ms: 2_000 });
        await lifecycle(provider);
        expect(requests.every((request) => request.headers.authorization === "Bearer sm_test")).toBe(true);
        expect(requests.find((request) => request.path === "/v3/documents" && request.method === "POST")!.body).not.toContain("source_event_id");
        expect(requests.find((request) => request.path === "/v3/documents" && request.method === "POST")!.body).toContain("source_ref");
        await expect(new supermemory_provider().initialize({ base_url: url })).rejects.toThrow("SUPERMEMORY_API_KEY");
    });

    it("uses authenticated Zep Cloud batches and polls batch indexing", async () => {
        const requests: request_record[] = [];
        const url = await start_server((request, response) => {
            requests.push(request);
            if (request.path === "/graph/list-all?pageNumber=1&pageSize=1") return respond(response, { graphs: [] });
            if (request.method === "DELETE") return respond(response, {}, 404);
            if (request.path === "/graph/create") return respond(response, { graph_id: "omb_run_case" });
            if (request.path === "/batches" && request.method === "POST") return respond(response, { batch_id: "batch", status: "draft" });
            if (request.path === "/batches/batch/items") return respond(response, []);
            if (request.path === "/batches/batch/process") return respond(response, { batch_id: "batch", status: "queued" });
            if (request.path === "/batches/batch") return respond(response, { batch_id: "batch", status: "succeeded", progress: { total_items: 1, succeeded_items: 1 } });
            if (request.path === "/graph/search") return respond(response, { episodes: [{ uuid: "episode", content: events[0].text, metadata: { source_event_id: "evidence" } }] });
            return respond(response, {}, 404);
        });
        const provider = new graphiti_provider();
        await provider.initialize({ base_url: url, api_key: "zep_test", timeout_ms: 2_000 });
        await lifecycle(provider);
        expect(requests.every((request) => request.headers.authorization === "Api-Key zep_test")).toBe(true);
        expect(JSON.parse(requests.find((request) => request.path === "/batches/batch/items")!.body)).toMatchObject({
            items: [{ type: "graph_episode", graph_id: "omb_run_case", data_type: "text", data: events[0].text }],
        });
        expect(requests.find((request) => request.path === "/batches/batch/items")!.body).not.toContain("source_event_id");
        expect(requests.find((request) => request.path === "/batches/batch/items")!.body).toContain("source_ref");
        expect(JSON.parse(requests.filter((request) => request.path === "/graph/search").at(-1)!.body)).toMatchObject({
            graph_id: "omb_run_case",
            scope: "episodes",
            limit: 5,
        });
        await provider.reset(scope);
        const long = [{ ...events[0], id: "long", text: "x".repeat(500) }];
        const indexed = await provider.ingest(long, scope);
        await provider.await_indexing(indexed, scope);
        const readiness = requests.filter((request) => request.path === "/graph/search").map((request) => JSON.parse(request.body)).find((body) => body.query?.startsWith("x"));
        expect(readiness.query).toHaveLength(400);
        await expect(new graphiti_provider().initialize({ base_url: url })).rejects.toThrow("ZEP_API_KEY");
    });

    it("retains the explicit local Graphiti profile", async () => {
        const url = await start_server((request, response) => {
            if (request.path === "/healthcheck") return respond(response, { status: "healthy" });
            if (request.method === "DELETE") return respond(response, {}, 404);
            if (request.path === "/messages") return respond(response, { success: true }, 202);
            if (request.path.startsWith("/episodes/")) return respond(response, [{ uuid: "evidence" }]);
            if (request.path === "/search") return respond(response, { facts: [{ uuid: "fact", name: "evidence", fact: events[0].text }] });
            return respond(response, {}, 404);
        });
        const provider = new graphiti_provider();
        await provider.initialize({ base_url: url, profile: "local", timeout_ms: 2_000 });
        await lifecycle(provider);
    });

    it("uses cognee multipart add and chunks search", async () => {
        const requests: request_record[] = [];
        let document_name = "";
        const url = await start_server((request, response) => {
            requests.push(request);
            if (request.path === "/health") return respond(response, { status: "healthy" });
            if (request.path === "/api/v1/datasets") return respond(response, []);
            if (request.path === "/api/v1/add") {
                document_name = /filename="([a-f0-9]{64})\.txt"/.exec(request.body)?.[1] ?? "";
                return respond(response, { status: "completed" });
            }
            if (request.path === "/api/v1/cognify") return respond(response, { status: "completed" });
            if (request.path === "/api/v1/search") return respond(response, [{ text: events[0].text, document_name }]);
            return respond(response, {}, 404);
        });
        const provider = new cognee_provider();
        await provider.initialize({ base_url: url });
        await lifecycle(provider);
        const provenance_hits = await provider.search("Who is my dentist?", 5, scope);
        expect(provenance_hits[0].metadata.source_refs).toHaveLength(1);
        expect(JSON.stringify(provenance_hits[0].metadata.source_refs)).not.toContain("evidence");
        const many = Array.from({ length: 401 }, (_, index): benchmark_event => ({
            id: `event-${index}`,
            text: `memory turn ${index}`,
            timestamp: Date.UTC(2026, 0, index + 1),
            metadata: {},
        }));
        await provider.ingest(many, scope);
        const adds = requests.filter((request) => request.path === "/api/v1/add");
        expect(adds).toHaveLength(3);
        expect(adds.every((request) => request.headers["content-type"]?.includes("multipart/form-data"))).toBe(true);
        expect(adds[0].body).toContain(events[0].text);
        expect(adds[0].body).toContain("2026-01-01T00:00:00.000Z");
        expect(adds[0].body).not.toContain("source_event_id");
        expect(adds[0].body).not.toContain("evidence.txt");
        expect(adds[1].body).toContain("memory turn 0");
        expect(adds[1].body).toContain("memory turn 399");
        expect(adds[1].body).not.toContain("memory turn 400\r\n");
        expect(adds[2].body).toContain("memory turn 400");
        expect(JSON.parse(requests.find((request) => request.path === "/api/v1/cognify")!.body).data_per_batch).toBe(4);
        expect(JSON.parse(requests.find((request) => request.path === "/api/v1/search")!.body)).toMatchObject({ search_type: "CHUNKS", only_context: false });
    });
});
