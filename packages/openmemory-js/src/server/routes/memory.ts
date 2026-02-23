import { q, vector_store } from "../../core/db";
import { now, rid, j, p } from "../../utils";
import {
    add_hsg_memory,
    hsg_query,
    reinforce_memory,
    update_memory,
} from "../../memory/hsg";
import { ingestDocument, ingestURL } from "../../ops/ingest";
import { env } from "../../core/cfg";
import { update_user_summary } from "../../memory/user_summary";
import { audit_log } from "../../core/audit";
import { background_task_runs_total } from "../../core/metrics";

/** OM-14: Contextual error handler for fire-and-forget async ops */
const bg_err = (op: string, id: string) => (e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[bg:${op}] id=${id} error=${msg}`);
    background_task_runs_total.inc({ task_name: `bg_${op}`, status: "failure" });
};
import type {
    add_req,
    q_req,
    ingest_req,
    ingest_url_req,
} from "../../core/types";

export function mem(app: any) {
    app.post("/memory/add", async (req: any, res: any) => {
        const b = req.body as add_req;
        if (!b?.content) return res.status(400).json({ err: "content" });
        try {
            const m = await add_hsg_memory(
                b.content,
                j(b.tags || []),
                b.metadata,
                b.user_id,
                b.upsert_key,
            );
            res.json(m);

            // Audit log (fire-and-forget)
            audit_log("memory", m.id, "create", {
                actor_id: b.user_id,
                metadata: { tags: b.tags, sector: m.primary_sector },
            }).catch(bg_err("audit_create", m.id));

            if (b.user_id) {
                update_user_summary(b.user_id).catch(bg_err("user_summary", m.id));
            }
        } catch (e: any) {
            console.error("[mem] add failed:", e);
            res.status(500).json({ err: "memory_add_failed" });
        }
    });

    app.post("/memory/ingest", async (req: any, res: any) => {
        const b = req.body as ingest_req;
        if (!b?.content_type || !b?.data)
            return res.status(400).json({ err: "missing" });
        // Pre-decode payload size validation
        const decoded_size = (b.data.length * 3) / 4;
        if (decoded_size > env.max_ingest_bytes) {
            return res.status(413).json({ err: 'payload_too_large', max_bytes: env.max_ingest_bytes, received_approx: decoded_size });
        }
        try {
            const r = await ingestDocument(
                b.content_type,
                b.data,
                b.metadata,
                b.config,
                b.user_id,
            );
            res.json(r);

            // Audit log (fire-and-forget)
            audit_log("memory", r.root_memory_id, "ingest", {
                actor_id: b.user_id,
                metadata: {
                    content_type: b.content_type,
                    strategy: r.strategy,
                    child_count: r.child_count,
                },
            }).catch(bg_err("audit_ingest", r.root_memory_id));
        } catch (e: any) {
            console.error("[mem] ingest failed:", e);
            res.status(500).json({ err: "ingest_failed" });
        }
    });

    app.post("/memory/ingest/url", async (req: any, res: any) => {
        const b = req.body as ingest_url_req;
        if (!b?.url) return res.status(400).json({ err: "no_url" });
        try {
            const r = await ingestURL(b.url, b.metadata, b.config, b.user_id);
            res.json(r);
        } catch (e: any) {
            console.error("[mem] url ingest failed:", e);
            res.status(500).json({ err: "url_ingest_failed" });
        }
    });

    app.post("/memory/query", async (req: any, res: any) => {
        const b = req.body as q_req;
        const k = b.k || 8;
        try {
            const f = {
                sectors: b.filters?.sector ? [b.filters.sector] : undefined,
                minSalience: b.filters?.min_score,
                user_id: b.filters?.user_id || b.user_id,
                startTime: b.filters?.startTime,
                endTime: b.filters?.endTime,
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
            res.json({ query: b.query, matches: [] });
        }
    });

    app.post("/memory/reinforce", async (req: any, res: any) => {
        const b = req.body as { id: string; boost?: number; user_id?: string };
        if (!b?.id) return res.status(400).json({ err: "id" });
        try {
            await reinforce_memory(b.id, b.boost);
            res.json({ ok: true });

            // Audit log (fire-and-forget)
            audit_log("memory", b.id, "reinforce", {
                actor_id: b.user_id,
                changes: { boost: b.boost || 0.1 },
            }).catch(bg_err("audit_reinforce", b.id));
        } catch (e: any) {
            res.status(404).json({ err: "nf" });
        }
    });

    app.patch("/memory/:id", async (req: any, res: any) => {
        const id = req.params.id;
        const b = req.body as {
            content?: string;
            tags?: string[];
            metadata?: any;
            user_id?: string;
        };
        if (!id) return res.status(400).json({ err: "id" });
        try {

            const m = await q.get_mem.get(id);
            if (!m) return res.status(404).json({ err: "nf" });


            if (b.user_id && m.user_id !== b.user_id) {
                return res.status(403).json({ err: "forbidden" });
            }

            const r = await update_memory(id, b.content, b.tags, b.metadata);
            res.json(r);

            // Audit log (fire-and-forget)
            const changes: Record<string, unknown> = {};
            if (b.content !== undefined) changes.content = "updated";
            if (b.tags !== undefined) changes.tags = b.tags;
            if (b.metadata !== undefined) changes.metadata = "updated";
            audit_log("memory", id, "update", {
                actor_id: b.user_id || m.user_id,
                changes,
                metadata: { old_version: m.version, new_version: r.version },
            }).catch(bg_err("audit_update", id));
        } catch (e: any) {
            if (e.message.includes("not found")) {
                res.status(404).json({ err: "nf" });
            } else {
                res.status(500).json({ err: "internal" });
            }
        }
    });

    app.get("/memory/all", async (req: any, res: any) => {
        try {
            const u = req.query.u ? parseInt(req.query.u) : 0;
            const l = req.query.l ? parseInt(req.query.l) : 100;
            const s = req.query.sector;
            const user_id = req.query.user_id;

            let r;
            if (user_id) {

                r = await q.all_mem_by_user.all(user_id, l, u);
            } else if (s) {

                r = await q.all_mem_by_sector.all(s, l, u);
            } else {

                r = await q.all_mem.all(l, u);
            }

            const i = r.map((x: any) => ({
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
            res.status(500).json({ err: "internal" });
        }
    });

    app.get("/memory/:id", async (req: any, res: any) => {
        try {
            const id = req.params.id;
            const user_id = req.query.user_id;
            const m = await q.get_mem.get(id);
            if (!m) return res.status(404).json({ err: "nf" });


            if (user_id && m.user_id !== user_id) {
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
            res.status(500).json({ err: "internal" });
        }
    });

    app.delete("/memory/:id", async (req: any, res: any) => {
        try {
            const id = req.params.id;
            const user_id = req.query.user_id || req.body?.user_id;
            const m = await q.get_mem.get(id);
            if (!m) return res.status(404).json({ err: "nf" });


            if (user_id && m.user_id !== user_id) {
                return res.status(403).json({ err: "forbidden" });
            }

            await q.del_mem.run(id);
            await vector_store.deleteVectors(id);
            await q.del_waypoints.run(id, id);
            res.json({ ok: true });

            // Audit log (fire-and-forget)
            audit_log("memory", id, "delete", {
                actor_id: user_id || m.user_id,
                metadata: { sector: m.primary_sector, version: m.version },
            }).catch(bg_err("audit_delete", id));
        } catch (e: any) {
            res.status(500).json({ err: "internal" });
        }
    });
}
