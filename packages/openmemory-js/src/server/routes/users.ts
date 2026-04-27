import { q, vector_store } from "../../core/db";
import { p } from "../../utils";
import {
    update_user_summary,
    auto_update_user_summaries,
} from "../../memory/user_summary";
import { require_tenant, reject_tenant_mismatch } from "../middleware/tenant";

/**
 * SECURITY: All `/users/:user_id/...` routes used to trust the path
 * parameter — any authenticated client could pull every other tenant's
 * data by changing the slug. We now ignore the slug entirely (or 403
 * if it disagrees with the authenticated tenant) and operate against
 * `req.tenant`. The path parameter is preserved in the URL surface only
 * for backwards-compatible URL shapes.
 */
export const usr = (app: any) => {
    app.get("/users/:user_id/summary", async (req: any, res: any) => {
        const tenant = require_tenant(req, res);
        if (!tenant) return;
        if (reject_tenant_mismatch(res, tenant, req.params.user_id)) return;
        try {
            const user = await q.get_user.get(tenant);
            if (!user) return res.status(404).json({ error: "user not found" });
            res.json({
                user_id: user.user_id,
                summary: user.summary,
                reflection_count: user.reflection_count,
                updated_at: user.updated_at,
            });
        } catch (err: any) {
            console.error("[users] summary failed:", err);
            res.status(500).json({ error: "internal" });
        }
    });

    app.post(
        "/users/:user_id/summary/regenerate",
        async (req: any, res: any) => {
            const tenant = require_tenant(req, res);
            if (!tenant) return;
            if (reject_tenant_mismatch(res, tenant, req.params.user_id)) return;
            try {
                await update_user_summary(tenant);
                const user = await q.get_user.get(tenant);
                res.json({
                    ok: true,
                    user_id: tenant,
                    summary: user?.summary,
                    reflection_count: user?.reflection_count,
                });
            } catch (err: any) {
                console.error("[users] regenerate failed:", err);
                res.status(500).json({ err: "internal" });
            }
        },
    );

    /**
     * Bulk regenerate. This is an admin-style endpoint — keep it
     * tenant-scoped (regenerate only the caller's summary). If a future
     * deployment needs a global admin to regenerate all tenants, gate
     * that behind an explicit OM_ADMIN_KEY check; do NOT re-open this
     * route to all callers.
     */
    app.post("/users/summaries/regenerate-all", async (req: any, res: any) => {
        const tenant = require_tenant(req, res);
        if (!tenant) return;
        try {
            // Backwards-compat shape: kept the route name, but it now only
            // updates the authenticated tenant. Multi-tenant fan-out is
            // explicitly opt-in via OM_ADMIN_REGENERATE_ALL=true.
            if (process.env.OM_ADMIN_REGENERATE_ALL === "true") {
                const result = await auto_update_user_summaries();
                return res.json({ ok: true, updated: result.updated, scope: "all" });
            }
            await update_user_summary(tenant);
            res.json({ ok: true, updated: 1, scope: "self" });
        } catch (err: any) {
            console.error("[users] regenerate-all failed:", err);
            res.status(500).json({ err: "internal" });
        }
    });

    app.get("/users/:user_id/memories", async (req: any, res: any) => {
        const tenant = require_tenant(req, res);
        if (!tenant) return;
        if (reject_tenant_mismatch(res, tenant, req.params.user_id)) return;
        try {
            const l_raw = req.query.l ? parseInt(req.query.l, 10) : 100;
            const u_raw = req.query.u ? parseInt(req.query.u, 10) : 0;
            if (
                !Number.isFinite(l_raw) ||
                !Number.isFinite(u_raw) ||
                l_raw < 0 ||
                u_raw < 0 ||
                l_raw > 10_000
            ) {
                return res.status(400).json({ error: "invalid_pagination" });
            }
            const r = await q.all_mem_by_user.all(tenant, l_raw, u_raw);
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
            }));
            res.json({ user_id: tenant, items: i });
        } catch (err: any) {
            console.error("[users] memories failed:", err);
            res.status(500).json({ err: "internal" });
        }
    });

    app.delete("/users/:user_id/memories", async (req: any, res: any) => {
        const tenant = require_tenant(req, res);
        if (!tenant) return;
        if (reject_tenant_mismatch(res, tenant, req.params.user_id)) return;
        try {
            const mems = await q.all_mem_by_user.all(tenant, 10000, 0);
            let deleted = 0;
            for (const m of mems) {
                await q.del_mem.run(m.id);
                await vector_store.deleteVectors(m.id);
                await q.del_waypoints.run(m.id, m.id);
                deleted++;
            }
            res.json({ ok: true, deleted });
        } catch (err: any) {
            console.error("[users] delete memories failed:", err);
            res.status(500).json({ err: "internal" });
        }
    });
};
