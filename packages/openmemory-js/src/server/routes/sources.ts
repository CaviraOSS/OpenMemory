/**
 * sources webhook routes - ingest data from external sources via HTTP
 *
 * POST /sources/:source/ingest
 *   body: { creds: {...}, filters: {...}, user_id?: string }
 *
 * POST /sources/webhook/:source
 *   generic webhook endpoint for source-specific payloads
 */

import * as sources from "../../sources";

export function src(app: any) {

    app.get("/sources", async (req: any, res: any) => {
        res.json({
            sources: ["github", "notion", "google_drive", "google_sheets", "google_slides", "onedrive", "web_crawler"],
            usage: {
                ingest: "POST /sources/:source/ingest { creds: {}, filters: {}, user_id? }",
                webhook: "POST /sources/webhook/:source (source-specific payload)"
            }
        });
    });


    app.post("/sources/:source/ingest", async (req: any, res: any) => {
        const { source } = req.params;
        const { creds = {}, filters = {}, user_id } = req.body || {};

        const source_map: Record<string, any> = {
            github: sources.github_source,
            notion: sources.notion_source,
            google_drive: sources.google_drive_source,
            google_sheets: sources.google_sheets_source,
            google_slides: sources.google_slides_source,
            onedrive: sources.onedrive_source,
            web_crawler: sources.web_crawler_source,
        };

        if (!source_map[source]) {
            return res.status(400).json({ error: `unknown source: ${source}`, available: Object.keys(source_map) });
        }

        try {
            const src = new source_map[source](user_id);
            await src.connect(creds);
            const ids = await src.ingest_all(filters);
            res.json({ ok: true, ingested: ids.length, memory_ids: ids });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });


    app.post("/sources/webhook/github", async (req: any, res: any) => {
        const event_type = req.headers["x-github-event"];
        const payload = req.body;

        if (!payload) {
            return res.status(400).json({ error: "no payload" });
        }

        try {
            const { ingestDocument } = await import("../../ops/ingest");


            let content = "";
            let meta: Record<string, any> = { source: "github_webhook", event: event_type };

            if (event_type === "push") {
                const commits = payload.commits || [];
                content = commits.map((c: any) => `${c.message}\n${c.url}`).join("\n\n");
                meta.repo = payload.repository?.full_name;
                meta.ref = payload.ref;
            } else if (event_type === "issues") {
                content = `[${payload.action}] ${payload.issue?.title}\n${payload.issue?.body || ""}`;
                meta.repo = payload.repository?.full_name;
                meta.issue_number = payload.issue?.number;
            } else if (event_type === "pull_request") {
                content = `[${payload.action}] PR: ${payload.pull_request?.title}\n${payload.pull_request?.body || ""}`;
                meta.repo = payload.repository?.full_name;
                meta.pr_number = payload.pull_request?.number;
            } else {
                content = JSON.stringify(payload, null, 2);
            }

            if (content) {
                const result = await ingestDocument("text", content, meta);
                res.json({ ok: true, memory_id: result.root_memory_id, event: event_type });
            } else {
                res.json({ ok: true, skipped: true, reason: "no content" });
            }
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });


    app.post("/sources/webhook/notion", async (req: any, res: any) => {
        const payload = req.body;

        try {
            const { ingestDocument } = await import("../../ops/ingest");
            const content = JSON.stringify(payload, null, 2);
            const result = await ingestDocument("text", content, { source: "notion_webhook" });
            res.json({ ok: true, memory_id: result.root_memory_id });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });
}
