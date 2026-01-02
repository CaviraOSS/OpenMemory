"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.start_mcp_stdio = exports.mcp = exports.create_mcp_srv = void 0;
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const streamableHttp_js_1 = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
const cfg_1 = require("../core/cfg");
const hsg_1 = require("../memory/hsg");
const db_1 = require("../core/db");
const embed_1 = require("../memory/embed");
const utils_1 = require("../utils");
const user_summary_1 = require("../memory/user_summary");
const sec_enum = zod_1.z.enum([
    "episodic",
    "semantic",
    "procedural",
    "emotional",
    "reflective",
]);
const trunc = (val, max = 200) => val.length <= max ? val : `${val.slice(0, max).trimEnd()}...`;
const build_mem_snap = (row) => ({
    id: row.id,
    primary_sector: row.primary_sector,
    salience: Number(row.salience.toFixed(3)),
    last_seen_at: row.last_seen_at,
    user_id: row.user_id,
    content_preview: trunc(row.content, 240),
});
const fmt_matches = (matches) => matches
    .map((m, idx) => {
    const prev = trunc(m.content.replace(/\s+/g, " ").trim(), 200);
    return `${idx + 1}. [${m.primary_sector}] score=${m.score.toFixed(3)} salience=${m.salience.toFixed(3)} id=${m.id}\n${prev}`;
})
    .join("\n\n");
const set_hdrs = (res) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,Mcp-Session-Id");
};
const send_err = (res, code, msg, id = null, status = 400) => {
    if (!res.headersSent) {
        res.statusCode = status;
        set_hdrs(res);
        res.end(JSON.stringify({
            jsonrpc: "2.0",
            error: { code, message: msg },
            id,
        }));
    }
};
const uid = (val) => (val?.trim() ? val.trim() : undefined);
const create_mcp_srv = () => {
    const srv = new mcp_js_1.McpServer({
        name: "openmemory-mcp",
        version: "2.1.0",
    }, { capabilities: { tools: {}, resources: {}, logging: {} } });
    srv.tool("openmemory_query", "Run a semantic retrieval against OpenMemory", {
        query: zod_1.z
            .string()
            .min(1, "query text is required")
            .describe("Free-form search text"),
        k: zod_1.z
            .number()
            .int()
            .min(1)
            .max(32)
            .default(8)
            .describe("Maximum results to return"),
        sector: sec_enum
            .optional()
            .describe("Restrict search to a specific sector"),
        min_salience: zod_1.z
            .number()
            .min(0)
            .max(1)
            .optional()
            .describe("Minimum salience threshold"),
        user_id: zod_1.z
            .string()
            .trim()
            .min(1)
            .optional()
            .describe("Isolate results to a specific user identifier"),
    }, async ({ query, k, sector, min_salience, user_id }) => {
        const u = uid(user_id);
        const flt = sector || min_salience !== undefined || u
            ? {
                ...(sector
                    ? { sectors: [sector] }
                    : {}),
                ...(min_salience !== undefined
                    ? { minSalience: min_salience }
                    : {}),
                ...(u ? { user_id: u } : {}),
            }
            : undefined;
        const matches = await (0, hsg_1.hsg_query)(query, k ?? 8, flt);
        const summ = matches.length
            ? fmt_matches(matches)
            : "No memories matched the supplied query.";
        const pay = matches.map((m) => ({
            id: m.id,
            score: Number(m.score.toFixed(4)),
            primary_sector: m.primary_sector,
            sectors: m.sectors,
            salience: Number(m.salience.toFixed(4)),
            last_seen_at: m.last_seen_at,
            path: m.path,
            content: m.content,
        }));
        return {
            content: [
                { type: "text", text: summ },
                {
                    type: "text",
                    text: JSON.stringify({ query, matches: pay }, null, 2),
                },
            ],
        };
    });
    srv.tool("openmemory_store", "Persist new content into OpenMemory", {
        content: zod_1.z.string().min(1).describe("Raw memory text to store"),
        tags: zod_1.z.array(zod_1.z.string()).optional().describe("Optional tag list"),
        metadata: zod_1.z
            .record(zod_1.z.any())
            .optional()
            .describe("Arbitrary metadata blob"),
        user_id: zod_1.z
            .string()
            .trim()
            .min(1)
            .optional()
            .describe("Associate the memory with a specific user identifier"),
    }, async ({ content, tags, metadata, user_id }) => {
        const u = uid(user_id);
        const res = await (0, hsg_1.add_hsg_memory)(content, (0, utils_1.j)(tags || []), metadata, u);
        if (u)
            (0, user_summary_1.update_user_summary)(u).catch((err) => console.error("[MCP] user summary update failed:", err));
        const txt = `Stored memory ${res.id} (primary=${res.primary_sector}) across sectors: ${res.sectors.join(", ")}${u ? ` [user=${u}]` : ""}`;
        const payload = {
            id: res.id,
            primary_sector: res.primary_sector,
            sectors: res.sectors,
            user_id: u ?? null,
        };
        return {
            content: [
                { type: "text", text: txt },
                { type: "text", text: JSON.stringify(payload, null, 2) },
            ],
        };
    });
    srv.tool("openmemory_reinforce", "Boost salience for an existing memory", {
        id: zod_1.z.string().min(1).describe("Memory identifier to reinforce"),
        boost: zod_1.z
            .number()
            .min(0.01)
            .max(1)
            .default(0.1)
            .describe("Salience boost amount (default 0.1)"),
    }, async ({ id, boost }) => {
        await (0, hsg_1.reinforce_memory)(id, boost);
        return {
            content: [
                {
                    type: "text",
                    text: `Reinforced memory ${id} by ${boost}`,
                },
            ],
        };
    });
    srv.tool("openmemory_list", "List recent memories for quick inspection", {
        limit: zod_1.z
            .number()
            .int()
            .min(1)
            .max(50)
            .default(10)
            .describe("Number of memories to return"),
        sector: sec_enum
            .optional()
            .describe("Optionally limit to a sector"),
        user_id: zod_1.z
            .string()
            .trim()
            .min(1)
            .optional()
            .describe("Restrict results to a specific user identifier"),
    }, async ({ limit, sector, user_id }) => {
        const u = uid(user_id);
        let rows;
        if (u) {
            const all = await db_1.q.all_mem_by_user.all(u, limit ?? 10, 0);
            rows = sector
                ? all.filter((row) => row.primary_sector === sector)
                : all;
        }
        else {
            rows = sector
                ? await db_1.q.all_mem_by_sector.all(sector, limit ?? 10, 0)
                : await db_1.q.all_mem.all(limit ?? 10, 0);
        }
        const items = rows.map((row) => ({
            ...build_mem_snap(row),
            tags: (0, utils_1.p)(row.tags || "[]"),
            metadata: (0, utils_1.p)(row.meta || "{}"),
        }));
        const lns = items.map((item, idx) => `${idx + 1}. [${item.primary_sector}] salience=${item.salience} id=${item.id}${item.tags.length ? ` tags=${item.tags.join(", ")}` : ""}${item.user_id ? ` user=${item.user_id}` : ""}\n${item.content_preview}`);
        return {
            content: [
                {
                    type: "text",
                    text: lns.join("\n\n") || "No memories stored yet.",
                },
                { type: "text", text: JSON.stringify({ items }, null, 2) },
            ],
        };
    });
    srv.tool("openmemory_get", "Fetch a single memory by identifier", {
        id: zod_1.z.string().min(1).describe("Memory identifier to load"),
        include_vectors: zod_1.z
            .boolean()
            .default(false)
            .describe("Include sector vector metadata"),
        user_id: zod_1.z
            .string()
            .trim()
            .min(1)
            .optional()
            .describe("Validate ownership against a specific user identifier"),
    }, async ({ id, include_vectors, user_id }) => {
        const u = uid(user_id);
        const mem = await db_1.q.get_mem.get(id);
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
            ? await db_1.vector_store.getVectorsById(id)
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
            tags: (0, utils_1.p)(mem.tags || "[]"),
            metadata: (0, utils_1.p)(mem.meta || "{}"),
            sectors: include_vectors
                ? vecs.map((v) => v.sector)
                : undefined,
        };
        return {
            content: [{ type: "text", text: JSON.stringify(pay, null, 2) }],
        };
    });
    srv.resource("openmemory-config", "openmemory://config", {
        mimeType: "application/json",
        description: "Runtime configuration snapshot for the OpenMemory MCP server",
    }, async () => {
        const stats = await (0, db_1.all_async)(`select primary_sector as sector, count(*) as count, avg(salience) as avg_salience from ${db_1.memories_table} group by primary_sector`);
        const pay = {
            mode: cfg_1.env.mode,
            sectors: hsg_1.sector_configs,
            stats,
            embeddings: (0, embed_1.getEmbeddingInfo)(),
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
    });
    srv.server.oninitialized = () => {
        // Use stderr for debug output, not stdout
        console.error("[MCP] initialization completed with client:", srv.server.getClientVersion());
    };
    return srv;
};
exports.create_mcp_srv = create_mcp_srv;
const extract_pay = async (req) => {
    if (req.body !== undefined) {
        if (typeof req.body === "string") {
            if (!req.body.trim())
                return undefined;
            return JSON.parse(req.body);
        }
        if (typeof req.body === "object" && req.body !== null)
            return req.body;
        return undefined;
    }
    const raw = await new Promise((resolve, reject) => {
        let buf = "";
        req.on("data", (chunk) => {
            buf += chunk;
        });
        req.on("end", () => resolve(buf));
        req.on("error", reject);
    });
    if (!raw.trim())
        return undefined;
    return JSON.parse(raw);
};
const mcp = (app) => {
    const srv = (0, exports.create_mcp_srv)();
    const trans = new streamableHttp_js_1.StreamableHTTPServerTransport({
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
    const handle_req = async (req, res) => {
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
        }
        catch (error) {
            console.error("[MCP] Error handling request:", error);
            if (error instanceof SyntaxError) {
                send_err(res, -32600, "Invalid JSON payload");
                return;
            }
            if (!res.headersSent)
                send_err(res, -32603, "Internal server error", error?.id ?? null, 500);
        }
    };
    app.post("/mcp", (req, res) => {
        void handle_req(req, res);
    });
    app.options("/mcp", (_req, res) => {
        res.statusCode = 204;
        set_hdrs(res);
        res.end();
    });
    const method_not_allowed = (_req, res) => {
        send_err(res, -32600, "Method not supported. Use POST  /mcp with JSON payload.", null, 405);
    };
    app.get("/mcp", method_not_allowed);
    app.delete("/mcp", method_not_allowed);
    app.put("/mcp", method_not_allowed);
};
exports.mcp = mcp;
const start_mcp_stdio = async () => {
    const srv = (0, exports.create_mcp_srv)();
    const trans = new stdio_js_1.StdioServerTransport();
    await srv.connect(trans);
    // console.error("[MCP] STDIO transport connected"); // Use stderr for debug output, not stdout
};
exports.start_mcp_stdio = start_mcp_stdio;
if (typeof require !== "undefined" && require.main === module) {
    void (0, exports.start_mcp_stdio)().catch((error) => {
        console.error("[MCP] STDIO startup failed:", error);
        process.exitCode = 1;
    });
}
