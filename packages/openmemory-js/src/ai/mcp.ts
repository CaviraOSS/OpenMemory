import type { IncomingMessage, ServerResponse } from "http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { env } from "../core/cfg";
import {
    add_hsg_memory,
    hsg_query,
    reinforce_memory,
    delete_memory,
    sector_configs,
} from "../memory/hsg";
import { q, all_async, memories_table, vector_store } from "../core/db";
import { getEmbeddingInfo } from "../memory/embed";
import { j, p } from "../utils";
import type { sector_type, mem_row, rpc_err_code } from "../core/types";
import { update_user_summary } from "../memory/user_summary";
import { insert_fact } from "../temporal_graph/store";
import { query_facts_at_time } from "../temporal_graph/query";
import { ToolRegistry } from "./mcp_tools";

const sec_enum = z.enum([
    "episodic",
    "semantic",
    "procedural",
    "emotional",
    "reflective",
] as const);

const trunc = (val: string, max = 200) =>
    val.length <= max ? val : `${val.slice(0, max).trimEnd()}...`;

const build_mem_snap = (row: mem_row) => ({
    id: row.id,
    primary_sector: row.primary_sector,
    salience: Number(row.salience.toFixed(3)),
    last_seen_at: row.last_seen_at,
    user_id: row.user_id,
    content_preview: trunc(row.content, 240),
});

const fmt_matches = (matches: Awaited<ReturnType<typeof hsg_query>>) =>
    matches
        .map((m: any, idx: any) => {
            const prev = trunc(m.content.replace(/\s+/g, " ").trim(), 200);
            return `${idx + 1}. [${m.primary_sector}] score=${m.score.toFixed(3)} salience=${m.salience.toFixed(3)} id=${m.id}\n${prev}`;
        })
        .join("\n\n");

const set_hdrs = (res: ServerResponse) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type,Authorization,Mcp-Session-Id",
    );
};

const send_err = (
    res: ServerResponse,
    code: rpc_err_code,
    msg: string,
    id: number | string | null = null,
    status = 400,
) => {
    if (!res.headersSent) {
        res.statusCode = status;
        set_hdrs(res);
        res.end(
            JSON.stringify({
                jsonrpc: "2.0",
                error: { code, message: msg },
                id,
            }),
        );
    }
};

const uid = (val?: string | null) => (val?.trim() ? val.trim() : undefined);

export const create_mcp_srv = () => {
    const srv = new McpServer(
        {
            name: "openmemory-mcp",
            version: "2.1.0",
        },
        { capabilities: { tools: {}, resources: {}, logging: {} } },
    );

    const registry = new ToolRegistry();

    registry.tool(
        "openmemory_query",
        "Query OpenMemory for contextual memories (HSG) and/or temporal facts",
        {
            query: z
                .string()
                .min(1, "query text is required")
                .describe("Free-form search text"),
            type: z
                .enum(["contextual", "factual", "unified"])
                .optional()
                .default("contextual")
                .describe(
                    "Query type: 'contextual' for HSG semantic search (default), 'factual' for temporal fact queries, 'unified' for both",
                ),
            fact_pattern: z
                .object({
                    subject: z
                        .string()
                        .optional()
                        .describe("Subject pattern (entity) - use undefined for wildcard"),
                    predicate: z
                        .string()
                        .optional()
                        .describe("Predicate pattern (relationship) - use undefined for wildcard"),
                    object: z
                        .string()
                        .optional()
                        .describe("Object pattern (value) - use undefined for wildcard"),
                })
                .optional()
                .describe(
                    "Fact pattern for temporal queries. Used when type is 'factual' or 'unified'",
                ),
            at: z
                .string()
                .optional()
                .describe(
                    "ISO date string for point-in-time queries (default: now). Queries facts valid at this time",
                ),
            k: z
                .number()
                .int()
                .min(1)
                .max(32)
                .default(8)
                .describe("Maximum results to return (for HSG queries)"),
            sector: sec_enum
                .optional()
                .describe("Restrict search to a specific sector (for HSG queries)"),
            min_salience: z
                .number()
                .min(0)
                .max(1)
                .optional()
                .describe("Minimum salience threshold (for HSG queries)"),
            user_id: z
                .string()
                .trim()
                .min(1)
                .optional()
                .describe("Isolate results to a specific user identifier"),
        },
        async ({
            query,
            type = "contextual",
            fact_pattern,
            at,
            k,
            sector,
            min_salience,
            user_id,
        }) => {
            const u = uid(user_id);
            const results: any = { type, query };
            const at_date = at ? new Date(at) : new Date();


            if (type === "contextual" || type === "unified") {
                const flt =
                    sector || min_salience !== undefined || u
                        ? {
                            ...(sector ? { sectors: [sector as sector_type] } : {}),
                            ...(min_salience !== undefined
                                ? { minSalience: min_salience }
                                : {}),
                            ...(u ? { user_id: u } : {}),
                        }
                        : undefined;

                const matches = await hsg_query(query, k ?? 8, flt);
                results.contextual = matches.map((m: any) => ({
                    source: "hsg",
                    id: m.id,
                    score: Number(m.score.toFixed(4)),
                    primary_sector: m.primary_sector,
                    sectors: m.sectors,
                    salience: Number(m.salience.toFixed(4)),
                    last_seen_at: m.last_seen_at,
                    path: m.path,
                    content: m.content,
                }));
            }


            if (type === "factual" || type === "unified") {
                const facts = await query_facts_at_time(
                    fact_pattern?.subject,
                    fact_pattern?.predicate,
                    fact_pattern?.object,
                    at_date,
                    0.0,
                );

                results.factual = facts.map((f: any) => ({
                    source: "temporal",
                    id: f.id,
                    subject: f.subject,
                    predicate: f.predicate,
                    object: f.object,
                    valid_from: f.valid_from,
                    valid_to: f.valid_to,
                    confidence: Number(f.confidence.toFixed(4)),
                    content: `${f.subject} ${f.predicate} ${f.object}`,
                }));
            }


            let summ = "";
            if (type === "contextual") {
                summ = results.contextual.length
                    ? fmt_matches(results.contextual)
                    : "No contextual memories matched the query.";
            } else if (type === "factual") {
                if (results.factual.length === 0) {
                    summ = "No temporal facts matched the query.";
                } else {
                    summ = results.factual
                        .map(
                            (f: any, idx: number) =>
                                `${idx + 1}. [fact] confidence=${f.confidence} id=${f.id}\n${f.content}`,
                        )
                        .join("\n\n");
                }
            } else {

                const ctx_count = results.contextual?.length || 0;
                const fact_count = results.factual?.length || 0;
                summ = `Found ${ctx_count} contextual memories and ${fact_count} temporal facts.\n\n`;

                if (ctx_count > 0) {
                    summ += "=== Contextual Memories ===\n";
                    summ += fmt_matches(results.contextual) + "\n\n";
                }

                if (fact_count > 0) {
                    summ += "=== Temporal Facts ===\n";
                    summ += results.factual
                        .map(
                            (f: any, idx: number) =>
                                `${idx + 1}. [fact] confidence=${f.confidence}\n${f.content}`,
                        )
                        .join("\n\n");
                }

                if (ctx_count === 0 && fact_count === 0) {
                    summ = "No results found in either system.";
                }
            }

            return {
                content: [
                    { type: "text", text: summ },
                    {
                        type: "text",
                        text: JSON.stringify(results, null, 2),
                    },
                ],
            };
        },
    );

    registry.tool(
        "openmemory_store",
        "Persist new content into OpenMemory (HSG contextual memory and/or temporal facts)",
        {
            content: z.string().min(1).describe("Raw memory text to store"),
            type: z
                .enum(["contextual", "factual", "both"])
                .optional()
                .default("contextual")
                .describe(
                    "Storage type: 'contextual' for HSG only (default), 'factual' for temporal facts only, 'both' for both systems",
                ),
            facts: z
                .array(
                    z.object({
                        subject: z.string().min(1).describe("Fact subject (entity)"),
                        predicate: z
                            .string()
                            .min(1)
                            .describe("Fact predicate (relationship)"),
                        object: z.string().min(1).describe("Fact object (value)"),
                        confidence: z
                            .number()
                            .min(0)
                            .max(1)
                            .optional()
                            .describe("Confidence score (0-1, default 1.0)"),
                        valid_from: z
                            .string()
                            .optional()
                            .describe(
                                "ISO date string for fact validity start (default: now)",
                            ),
                    }),
                )
                .optional()
                .describe(
                    "Array of facts to store in temporal graph. Required when type is 'factual' or 'both'",
                ),
            tags: z
                .array(z.string())
                .optional()
                .describe("Optional tag list (for HSG storage)"),
            metadata: z
                .record(z.any())
                .optional()
                .describe("Arbitrary metadata blob"),
            user_id: z
                .string()
                .trim()
                .min(1)
                .optional()
                .describe(
                    "Associate the memory with a specific user identifier",
                ),
        },
        async ({ content, type = "contextual", facts, tags, metadata, user_id }) => {
            const u = uid(user_id);
            const results: any = { type };


            if (
                (type === "factual" || type === "both") &&
                (!facts || facts.length === 0)
            ) {
                throw new Error(
                    `Facts array is required when type is '${type}'. Please provide at least one fact.`,
                );
            }


            if (type === "contextual" || type === "both") {
                const res = await add_hsg_memory(
                    content,
                    j(tags || []),
                    metadata,
                    u,
                );
                results.hsg = {
                    id: res.id,
                    primary_sector: res.primary_sector,
                    sectors: res.sectors,
                };

                if (u) {
                    update_user_summary(u).catch((err) =>
                        console.error("[MCP] user summary update failed:", err),
                    );
                }
            }


            if ((type === "factual" || type === "both") && facts) {
                const temporal_results = [];
                for (const fact of facts) {
                    const valid_from = fact.valid_from
                        ? new Date(fact.valid_from)
                        : new Date();
                    const confidence = fact.confidence ?? 1.0;

                    const fact_id = await insert_fact(
                        fact.subject,
                        fact.predicate,
                        fact.object,
                        valid_from,
                        confidence,
                        metadata,
                    );

                    temporal_results.push({
                        id: fact_id,
                        subject: fact.subject,
                        predicate: fact.predicate,
                        object: fact.object,
                        valid_from: valid_from.toISOString(),
                        confidence,
                    });
                }
                results.temporal = temporal_results;
            }


            let txt = "";
            if (type === "contextual") {
                txt = `Stored memory ${results.hsg.id} (primary=${results.hsg.primary_sector}) across sectors: ${results.hsg.sectors.join(", ")}${u ? ` [user=${u}]` : ""}`;
            } else if (type === "factual") {
                txt = `Stored ${results.temporal.length} temporal fact(s)${u ? ` [user=${u}]` : ""}`;
            } else {
                txt = `Stored in both systems: HSG memory ${results.hsg.id} + ${results.temporal.length} temporal fact(s)${u ? ` [user=${u}]` : ""}`;
            }

            return {
                content: [
                    { type: "text", text: txt },
                    {
                        type: "text",
                        text: JSON.stringify(
                            { ...results, user_id: u ?? null },
                            null,
                            2,
                        ),
                    },
                ],
            };
        },
    );

    registry.tool(
        "openmemory_reinforce",
        "Boost salience for an existing memory",
        {
            id: z.string().min(1).describe("Memory identifier to reinforce"),
            boost: z
                .number()
                .min(0.01)
                .max(1)
                .default(0.1)
                .describe("Salience boost amount (default 0.1)"),
        },
        async ({ id, boost }) => {
            await reinforce_memory(id, boost);
            return {
                content: [
                    {
                        type: "text",
                        text: `Reinforced memory ${id} by ${boost}`,
                    },
                ],
            };
        },
    );

    registry.tool(
        "openmemory_delete",
        "Delete a memory by identifier",
        {
            id: z.string().min(1).describe("Memory identifier to delete"),
            user_id: z.string().trim().min(1).optional().describe("Validate ownership"),
        },
        async ({ id, user_id }) => {
            const u = uid(user_id);
            if (u) {
                // Pre-check ownership if user_id provided
                const mem = await q.get_mem.get(id);
                if (mem && mem.user_id !== u) {
                    throw new Error(`Memory ${id} not found for user ${u}`);
                }
            }

            const success = await delete_memory(id);
            if (!success) {
                return {
                    content: [{ type: "text", text: `Memory ${id} not found or could not be deleted.` }],
                    isError: true
                };
            }

            return {
                content: [{ type: "text", text: `Memory ${id} successfully deleted.` }],
            };
        },
    );

    registry.tool(
        "openmemory_list",
        "List recent memories for quick inspection",
        {
            limit: z
                .number()
                .int()
                .min(1)
                .max(50)
                .default(10)
                .describe("Number of memories to return"),
            sector: sec_enum.optional().describe("Optionally limit to a sector"),
            user_id: z
                .string()
                .trim()
                .min(1)
                .optional()
                .describe("Restrict results to a specific user identifier"),
        },
        async ({ limit, sector, user_id }) => {
            const u = uid(user_id);
            let rows: mem_row[];
            if (u) {
                const all = await q.all_mem_by_user.all(u, limit ?? 10, 0);
                rows = sector
                    ? all.filter((row) => row.primary_sector === sector)
                    : all;
            } else {
                rows = sector
                    ? await q.all_mem_by_sector.all(sector, limit ?? 10, 0)
                    : await q.all_mem.all(limit ?? 10, 0);
            }
            const items = rows.map((row) => ({
                ...build_mem_snap(row),
                tags: p(row.tags || "[]") as string[],
                metadata: p(row.meta || "{}") as Record<string, unknown>,
            }));
            const lns = items.map(
                (item, idx) =>
                    `${idx + 1}. [${item.primary_sector}] salience=${item.salience} id=${item.id}${item.tags.length ? ` tags=${item.tags.join(", ")}` : ""}${item.user_id ? ` user=${item.user_id}` : ""}\n${item.content_preview}`,
            );
            return {
                content: [
                    {
                        type: "text",
                        text: lns.join("\n\n") || "No memories stored yet.",
                    },
                    { type: "text", text: JSON.stringify({ items }, null, 2) },
                ],
            };
        },
    );

    registry.tool(
        "openmemory_get",
        "Fetch a single memory by identifier",
        {
            id: z.string().min(1).describe("Memory identifier to load"),
            include_vectors: z
                .boolean()
                .default(false)
                .describe("Include sector vector metadata"),
            user_id: z
                .string()
                .trim()
                .min(1)
                .optional()
                .describe(
                    "Validate ownership against a specific user identifier",
                ),
        },
        async ({ id, include_vectors, user_id }) => {
            const u = uid(user_id);
            const mem = await q.get_mem.get(id);
            if (!mem)
                return {
                    content: [
                        { type: "text", text: `Memory ${id} not found.` },
                    ],
                };
            if (u && mem.user_id !== u)
                return {
                    content: [
                        {
                            type: "text",
                            text: `Memory ${id} not found for user ${u}.`,
                        },
                    ],
                };
            const vecs = include_vectors
                ? await vector_store.getVectorsById(id)
                : [];
            const pay = {
                id: mem.id,
                content: mem.content,
                primary_sector: mem.primary_sector,
                salience: mem.salience,
                decay_lambda: mem.decay_lambda,
                created_at: mem.created_at,
                updated_at: mem.updated_at,
                last_seen_at: mem.last_seen_at,
                user_id: mem.user_id,
                tags: p(mem.tags || "[]"),
                metadata: p(mem.meta || "{}"),
                sectors: include_vectors
                    ? vecs.map((v) => v.sector)
                    : undefined,
            };
            return {
                content: [{ type: "text", text: JSON.stringify(pay, null, 2) }],
            };
        },
    );
    registry.apply(srv);

    srv.resource(
        "openmemory-config",
        "openmemory://config",
        {
            mimeType: "application/json",
            description:
                "Runtime configuration snapshot for the OpenMemory MCP server",
        },
        async () => {
            const stats = await all_async(
                `select primary_sector as sector, count(*) as count, avg(salience) as avg_salience from ${memories_table} group by primary_sector`,
            );
            const pay = {
                mode: env.mode,
                sectors: sector_configs,
                stats,
                embeddings: getEmbeddingInfo(),
                server: { version: "2.1.0", protocol: "2025-06-18" },
                available_tools: [
                    "openmemory_query",
                    "openmemory_store",
                    "openmemory_reinforce",
                    "openmemory_list",
                    "openmemory_get",
                ],
            };
            return {
                contents: [
                    {
                        uri: "openmemory://config",
                        text: JSON.stringify(pay, null, 2),
                    },
                ],
            };
        },
    );

    srv.server.oninitialized = () => {

        console.error(
            "[MCP] initialization completed with client:",
            srv.server.getClientVersion(),
        );
    };
    return srv;
};

const extract_pay = async (req: IncomingMessage & { body?: any }) => {
    if (req.body !== undefined) {
        if (typeof req.body === "string") {
            if (!req.body.trim()) return undefined;
            return JSON.parse(req.body);
        }
        if (typeof req.body === "object" && req.body !== null) return req.body;
        return undefined;
    }
    const raw = await new Promise<string>((resolve, reject) => {
        let buf = "";
        req.on("data", (chunk) => {
            buf += chunk;
        });
        req.on("end", () => resolve(buf));
        req.on("error", reject);
    });
    if (!raw.trim()) return undefined;
    return JSON.parse(raw);
};

export const mcp = (app: any) => {
    const srv = create_mcp_srv();
    const trans = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
    });
    const srv_ready = srv
        .connect(trans)
        .then(() => {
            console.error("[MCP] Server started and transport connected");
        })
        .catch((error) => {
            console.error("[MCP] Failed to initialize transport:", error);
            throw error;
        });

    const handle_req = async (req: any, res: any) => {
        try {
            await srv_ready;
            const pay = await extract_pay(req);
            if (!pay || typeof pay !== "object") {
                send_err(res, -32600, "Request body must be a JSON object");
                return;
            }
            console.error("[MCP] Incoming request:", JSON.stringify(pay));
            set_hdrs(res);
            await trans.handleRequest(req, res, pay);
        } catch (error) {
            console.error("[MCP] Error handling request:", error);
            if (error instanceof SyntaxError) {
                send_err(res, -32600, "Invalid JSON payload");
                return;
            }
            if (!res.headersSent)
                send_err(
                    res,
                    -32603,
                    "Internal server error",
                    (error as any)?.id ?? null,
                    500,
                );
        }
    };

    app.post("/mcp", (req: any, res: any) => {
        void handle_req(req, res);
    });
    app.options("/mcp", (_req: any, res: any) => {
        res.statusCode = 204;
        set_hdrs(res);
        res.end();
    });

    const method_not_allowed = (_req: IncomingMessage, res: ServerResponse) => {
        send_err(
            res,
            -32600,
            "Method not supported. Use POST  /mcp with JSON payload.",
            null,
            405,
        );
    };
    app.get("/mcp", method_not_allowed);
    app.delete("/mcp", method_not_allowed);
    app.put("/mcp", method_not_allowed);
};

export const start_mcp_stdio = async () => {
    const srv = create_mcp_srv();
    const trans = new StdioServerTransport();
    await srv.connect(trans);

};

if (typeof require !== "undefined" && require.main === module) {
    void start_mcp_stdio().catch((error) => {
        console.error("[MCP] STDIO startup failed:", error);
        process.exitCode = 1;
    });
}
