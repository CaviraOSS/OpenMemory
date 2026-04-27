import { q, vector_store } from "../../core/db";
import { j, p } from "../../utils";
import {
    add_hsg_memory,
    hsg_query,
    reinforce_memory,
    update_memory,
} from "../../memory/hsg";
import { ingestDocument, ingestURL } from "../../ops/ingest";
import { update_user_summary } from "../../memory/user_summary";
import { require_tenant, reject_tenant_mismatch } from "../middleware/tenant";
import { parse_or_400, schema } from "../middleware/validate";

const add_schema: schema = {
    content: {
        type: "string",
        required: true,
        min_length: 1,
        max_length: 200_000,
    },
    tags: {
        type: "array",
        items: { type: "string", max_length: 256 },
        max_items: 64,
    },
    metadata: { type: "object" },
    user_id: { type: "string", max_length: 256 },
};

const ingest_schema: schema = {
    content_type: { type: "string", required: true, max_length: 64 },
    data: { type: "string", required: true, max_length: 5_000_000 },
    metadata: { type: "object" },
    config: { type: "object" },
    user_id: { type: "string", max_length: 256 },
};

const ingest_url_schema: schema = {
    url: { type: "string", required: true, min_length: 1, max_length: 8192 },
    metadata: { type: "object" },
    config: { type: "object" },
    user_id: { type: "string", max_length: 256 },
};

const query_schema: schema = {
    query: { type: "string", required: true, min_length: 1, max_length: 8192 },
    k: { type: "integer", min: 1, max: 200 },
    startTime: { type: "number", min: 0 },
    endTime: { type: "number", min: 0 },
    filters: {
        type: "object",
        fields: {
            sector: { type: "string", max_length: 64 },
            min_score: { type: "number", min: 0, max: 1 },
            user_id: { type: "string", max_length: 256 },
            startTime: { type: "number", min: 0 },
            endTime: { type: "number", min: 0 },
        },
    },
    user_id: { type: "string", max_length: 256 },
};

const reinforce_schema: schema = {
    id: { type: "string", required: true, min_length: 1, max_length: 256 },
    boost: { type: "number", min: 0, max: 100 },
};

const patch_schema: schema = {
    content: { type: "string", max_length: 200_000 },
    tags: {
        type: "array",
        items: { type: "string", max_length: 256 },
        max_items: 64,
    },
    metadata: { type: "object" },
    user_id: { type: "string", max_length: 256 },
};

export function mem(app: any) {
    app.post("/memory/add", async (req: any, res: any) => {
        const tenant = require_tenant(req, res);
        if (!tenant) return;
        const b = parse_or_400<{
            content: string;
            tags?: string[];
            metadata?: Record<string, unknown>;
            user_id?: string;
        }>(res, req.body, add_schema);
        if (!b) return;
        if (reject_tenant_mismatch(res, tenant, b.user_id)) return;
        try {
            const m = await add_hsg_memory(
                b.content,
                j(b.tags || []),
                b.metadata,
                tenant,
            );
            res.json(m);
            update_user_summary(tenant).catch((e) =>
                console.error("[mem] user summary update failed:", e),
            );
        } catch (e: any) {
            res.status(500).json({ err: e.message });
        }
    });

    app.post("/memory/ingest", async (req: any, res: any) => {
        const tenant = require_tenant(req, res);
        if (!tenant) return;
        const b = parse_or_400<{
            content_type: string;
            data: string;
            metadata?: Record<string, unknown>;
            config?: any;
            user_id?: string;
        }>(res, req.body, ingest_schema);
        if (!b) return;
        if (reject_tenant_mismatch(res, tenant, b.user_id)) return;
        try {
            const r = await ingestDocument(
                b.content_type as any,
                b.data,
                b.metadata,
                b.config,
                tenant,
            );
            res.json(r);
        } catch (e: any) {
            res.status(500).json({ err: "ingest_fail", msg: e.message });
        }
    });

    app.post("/memory/ingest/url", async (req: any, res: any) => {
        const tenant = require_tenant(req, res);
        if (!tenant) return;
        const b = parse_or_400<{
            url: string;
            metadata?: Record<string, unknown>;
            config?: any;
            user_id?: string;
        }>(res, req.body, ingest_url_schema);
        if (!b) return;
        if (reject_tenant_mismatch(res, tenant, b.user_id)) return;
        try {
            const r = await ingestURL(b.url, b.metadata, b.config, tenant);
            res.json(r);
        } catch (e: any) {
            res.status(500).json({ err: "url_fail", msg: e.message });
        }
    });

    app.post("/memory/query", async (req: any, res: any) => {
        const tenant = require_tenant(req, res);
        if (!tenant) return;
        const b = parse_or_400<{
            query: string;
            k?: number;
            startTime?: number;
            endTime?: number;
            filters?: {
                sector?: string;
                min_score?: number;
                user_id?: string;
                startTime?: number;
                endTime?: number;
            };
            user_id?: string;
        }>(res, req.body, query_schema);
        if (!b) return;
        if (reject_tenant_mismatch(res, tenant, b.user_id, b.filters?.user_id))
            return;

        const k = b.k || 8;
        try {
            const f = {
                sectors: b.filters?.sector ? [b.filters.sector] : undefined,
                minSalience: b.filters?.min_score,
                user_id: tenant,
                startTime: b.filters?.startTime ?? b.startTime,
                endTime: b.filters?.endTime ?? b.endTime,
            };
            const m = await hsg_query(b.query, k, f);
            res.json({
                query: b.query,
                matches: m.map((x: any) => ({
                    id: x.id,
                    content: x.content,
                    score: x.score,
                    sectors: x.sectors,
                    primary_sector: x.primary_sector,
                    path: x.path,
                    salience: x.salience,
                    last_seen_at: x.last_seen_at,
                })),
            });
        } catch (e: any) {
            // SECURITY: previously this swallowed errors and returned an
            // empty result set, hiding backend outages from clients and
            // making silent regressions invisible. Now report 500.
            console.error("[mem] /memory/query failed:", e);
            res.status(500).json({
                error: "query_failed",
                message: e?.message || "internal",
            });
        }
    });

    app.post("/memory/reinforce", async (req: any, res: any) => {
        const tenant = require_tenant(req, res);
        if (!tenant) return;
        const b = parse_or_400<{ id: string; boost?: number }>(
            res,
            req.body,
            reinforce_schema,
        );
        if (!b) return;
        try {
            const m = await q.get_mem.get(b.id);
            if (!m) return res.status(404).json({ err: "nf" });
            if (m.user_id && m.user_id !== tenant)
                return res.status(403).json({ err: "forbidden" });
            await reinforce_memory(b.id, b.boost);
            res.json({ ok: true });
        } catch (e: any) {
            res.status(404).json({ err: "nf" });
        }
    });

    app.patch("/memory/:id", async (req: any, res: any) => {
        const tenant = require_tenant(req, res);
        if (!tenant) return;
        const id = req.params.id;
        if (!id) return res.status(400).json({ err: "id" });
        const b = parse_or_400<{
            content?: string;
            tags?: string[];
            metadata?: any;
            user_id?: string;
        }>(res, req.body, patch_schema);
        if (!b) return;
        if (reject_tenant_mismatch(res, tenant, b.user_id)) return;
        try {
            const m = await q.get_mem.get(id);
            if (!m) return res.status(404).json({ err: "nf" });
            if (m.user_id && m.user_id !== tenant) {
                return res.status(403).json({ err: "forbidden" });
            }
            const r = await update_memory(id, b.content, b.tags, b.metadata);
            res.json(r);
        } catch (e: any) {
            if (e.message && e.message.includes("not found")) {
                res.status(404).json({ err: "nf" });
            } else {
                res.status(500).json({ err: "internal" });
            }
        }
    });

    app.get("/memory/all", async (req: any, res: any) => {
        const tenant = require_tenant(req, res);
        if (!tenant) return;
        if (reject_tenant_mismatch(res, tenant, req.query.user_id)) return;
        try {
            const u = req.query.u ? parseInt(req.query.u, 10) : 0;
            const l = req.query.l ? parseInt(req.query.l, 10) : 100;
            if (
                !Number.isFinite(u) ||
                !Number.isFinite(l) ||
                u < 0 ||
                l < 0 ||
                l > 10_000
            ) {
                return res.status(400).json({ error: "invalid_pagination" });
            }
            // Always scope to the authenticated tenant — sector filter is
            // applied client-side after the user_id filter.
            const r = await q.all_mem_by_user.all(tenant, l, u);
            const sector =
                typeof req.query.sector === "string"
                    ? req.query.sector
                    : undefined;
            const filtered = sector
                ? r.filter((x: any) => x.primary_sector === sector)
                : r;

            const i = filtered.map((x: any) => ({
                id: x.id,
                content: x.content,
                tags: p(x.tags),
                metadata: p(x.meta),
                created_at: x.created_at,
                updated_at: x.updated_at,
                last_seen_at: x.last_seen_at,
                salience: x.salience,
                decay_lambda: x.decay_lambda,
                primary_sector: x.primary_sector,
                version: x.version,
                user_id: x.user_id,
            }));
            res.json({ items: i });
        } catch (e: any) {
            console.error("[mem] /memory/all failed:", e);
            res.status(500).json({ err: "internal" });
        }
    });

    app.get("/memory/:id", async (req: any, res: any) => {
        const tenant = require_tenant(req, res);
        if (!tenant) return;
        if (reject_tenant_mismatch(res, tenant, req.query.user_id)) return;
        try {
            const id = req.params.id;
            const m = await q.get_mem.get(id);
            if (!m) return res.status(404).json({ err: "nf" });
            if (m.user_id && m.user_id !== tenant) {
                return res.status(403).json({ err: "forbidden" });
            }
            const v = await vector_store.getVectorsById(id);
            const sec = v.map((x: any) => x.sector);
            res.json({
                id: m.id,
                content: m.content,
                primary_sector: m.primary_sector,
                sectors: sec,
                tags: p(m.tags),
                metadata: p(m.meta),
                created_at: m.created_at,
                updated_at: m.updated_at,
                last_seen_at: m.last_seen_at,
                salience: m.salience,
                decay_lambda: m.decay_lambda,
                version: m.version,
                user_id: m.user_id,
            });
        } catch (e: any) {
            console.error("[mem] /memory/:id failed:", e);
            res.status(500).json({ err: "internal" });
        }
    });

    app.delete("/memory/:id", async (req: any, res: any) => {
        const tenant = require_tenant(req, res);
        if (!tenant) return;
        if (
            reject_tenant_mismatch(
                res,
                tenant,
                req.query.user_id,
                req.body?.user_id,
            )
        )
            return;
        try {
            const id = req.params.id;
            const m = await q.get_mem.get(id);
            if (!m) return res.status(404).json({ err: "nf" });
            if (m.user_id && m.user_id !== tenant) {
                return res.status(403).json({ err: "forbidden" });
            }
            await q.del_mem.run(id);
            await vector_store.deleteVectors(id);
            await q.del_waypoints.run(id, id);
            res.json({ ok: true });
        } catch (e: any) {
            console.error("[mem] /memory/:id delete failed:", e);
            res.status(500).json({ err: "internal" });
        }
    });
}
