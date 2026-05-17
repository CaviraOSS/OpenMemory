import assert from "assert";
import http from "http";

async function readBody(req: http.IncomingMessage): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString("utf8");
}

async function main() {
    let syncRequests = 0;
    let deleteRequests = 0;
    let queryRequests = 0;
    let healthOk = true;

    const server = http.createServer(async (req, res) => {
        res.setHeader("content-type", "application/json");

        if (req.method === "GET" && req.url === "/health") {
            res.end(JSON.stringify({ ok: healthOk, source: "test-bridge", error: healthOk ? null : "not configured" }));
            return;
        }

        if (req.method === "POST" && req.url === "/query") {
            queryRequests += 1;
            const body = JSON.parse(await readBody(req));
            res.end(JSON.stringify({ ok: true, query: body.query }));
            return;
        }

        if (req.method === "POST" && req.url === "/documents/upsert") {
            syncRequests += 1;
            res.end(JSON.stringify({ ok: true }));
            return;
        }

        if (req.method === "POST" && req.url === "/documents/delete") {
            deleteRequests += 1;
            res.end(JSON.stringify({ ok: true }));
            return;
        }

        res.statusCode = 404;
        res.end(JSON.stringify({ ok: false, error: "not found" }));
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert(address && typeof address === "object", "test server did not expose an address");

    process.env.OM_TIER = "hybrid";
    process.env.OM_GRAPHRAG_ENABLED = "true";
    process.env.OM_GRAPHRAG_URL = `http://127.0.0.1:${address.port}`;
    process.env.OM_GRAPHRAG_TIMEOUT_MS = "3000";
    process.env.OM_GRAPHRAG_BRIDGE_API_KEY = "test-bridge-key";
    process.env.OM_GRAPHRAG_WRITE_ENABLED = "true";
    process.env.OM_GRAPHRAG_ALLOW_UNAUTH_WRITE = "false";
    process.env.OM_GRAPHRAG_ALLOW_GLOBAL_QUERY = "true";
    process.env.OM_GRAPHRAG_ALLOW_UNFILTERED_SCOPED_QUERY = "false";
    process.env.OM_GRAPHRAG_SYNC_ON_ADD = "true";
    process.env.OM_GRAPHRAG_CONTEXT_ENABLED = "true";
    delete process.env.OM_API_KEY;

    try {
        const bridge = await import("../src/graphrag/bridge");

        const status = await bridge.getGraphRagStatus();
        assert.strictEqual(status.ok, true, "status should call the bridge when GraphRAG is enabled");

        healthOk = false;
        const failingStatus = await bridge.getGraphRagStatus();
        assert.strictEqual(failingStatus.ok, false, "bridge health ok=false should not be treated as success");
        assert.strictEqual(failingStatus.error, "not configured");
        healthOk = true;

        const query = await bridge.queryGraphRag({ query: "relationship-heavy question" });
        assert.strictEqual(query.ok, true, "query should call the bridge when GraphRAG is enabled");
        assert.strictEqual(queryRequests, 1, "query should issue one bridge request");

        const scopedQuery = await bridge.queryGraphRag({
            query: "relationship-heavy scoped question",
            project_id: "project-alpha",
        });
        assert.strictEqual(scopedQuery.ok, true, "scoped queries should reach the bridge now that server-side filtering exists");
        assert.strictEqual(queryRequests, 2, "scoped query should issue a bridge request");

        const sync = await bridge.syncGraphRagDocument({
            id: "memory-1",
            content: "private memory content",
        });
        assert.strictEqual(sync.skipped, true, "sync should be skipped without API key or explicit unauth write override");
        assert.strictEqual(
            sync.reason,
            "OM_API_KEY is required for GraphRAG writes unless OM_GRAPHRAG_ALLOW_UNAUTH_WRITE is true",
        );
        assert.strictEqual(syncRequests, 0, "write-gated sync must not call /documents/upsert");

        bridge.maybeSyncGraphRagDocument({
            id: "memory-2",
            content: "private memory content",
        });
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.strictEqual(syncRequests, 0, "auto-sync must not call /documents/upsert without authenticated write gate");

        const deletion = await bridge.deleteGraphRagDocument({ id: "memory-1" });
        assert.strictEqual(deletion.skipped, true, "delete should be skipped without API key or explicit unauth write override");
        assert.strictEqual(
            deletion.reason,
            "OM_API_KEY is required for GraphRAG writes unless OM_GRAPHRAG_ALLOW_UNAUTH_WRITE is true",
        );
        assert.strictEqual(deleteRequests, 0, "write-gated delete must not call /documents/delete");

        bridge.maybeDeleteGraphRagDocument({ id: "memory-2" });
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.strictEqual(deleteRequests, 0, "auto-delete must not call /documents/delete without authenticated write gate");

        console.log("GraphRAG bridge authenticated write gate verified.");
    } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
