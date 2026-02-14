/**
 * Audit Trail API Routes (D5)
 *
 * Provides read-only access to audit logs for compliance and debugging.
 */

import {
    query_audit_logs,
    count_audit_logs,
    get_resource_history,
    type AuditAction,
    type AuditQueryOptions,
} from "../../core/audit";

export function audit(app: any) {
    /**
     * GET /audit/logs
     *
     * Query audit logs with optional filters.
     *
     * Query params:
     *   - resource_id: Filter by specific resource
     *   - resource_type: Filter by type (memory, waypoint, fact, user)
     *   - action: Filter by action (create, update, delete, version, reinforce, ingest, merge)
     *   - actor_id: Filter by actor
     *   - from: Start timestamp (epoch ms)
     *   - to: End timestamp (epoch ms)
     *   - limit: Max results (default 100)
     *   - offset: Pagination offset (default 0)
     */
    app.get("/audit/logs", async (req: any, res: any) => {
        try {
            const options: AuditQueryOptions = {};

            if (req.query.resource_id) {
                options.resource_id = req.query.resource_id;
            }
            if (req.query.resource_type) {
                options.resource_type = req.query.resource_type;
            }
            if (req.query.action) {
                options.action = req.query.action as AuditAction;
            }
            if (req.query.actor_id) {
                options.actor_id = req.query.actor_id;
            }
            if (req.query.from) {
                options.from_ts = parseInt(req.query.from, 10);
            }
            if (req.query.to) {
                options.to_ts = parseInt(req.query.to, 10);
            }
            if (req.query.limit) {
                options.limit = Math.min(1000, parseInt(req.query.limit, 10));
            }
            if (req.query.offset) {
                options.offset = parseInt(req.query.offset, 10);
            }

            const [logs, total] = await Promise.all([
                query_audit_logs(options),
                count_audit_logs(options),
            ]);

            res.json({
                logs,
                total,
                limit: options.limit || 100,
                offset: options.offset || 0,
            });
        } catch (e: any) {
            console.error("[audit] query failed:", e);
            res.status(500).json({ err: "audit_query_failed" });
        }
    });

    /**
     * GET /audit/resource/:type/:id
     *
     * Get audit history for a specific resource.
     */
    app.get("/audit/resource/:type/:id", async (req: any, res: any) => {
        try {
            const { type, id } = req.params;
            const limit = req.query.limit
                ? Math.min(100, parseInt(req.query.limit, 10))
                : 50;

            if (!["memory", "waypoint", "fact", "user", "compliance_rule", "rule_set", "template"].includes(type)) {
                return res.status(400).json({ err: "invalid_resource_type" });
            }

            const history = await get_resource_history(type as any, id, limit);

            res.json({
                resource_type: type,
                resource_id: id,
                history,
            });
        } catch (e: any) {
            console.error("[audit] resource history failed:", e);
            res.status(500).json({ err: "audit_history_failed" });
        }
    });

    /**
     * GET /audit/stats
     *
     * Get audit statistics summary.
     */
    app.get("/audit/stats", async (req: any, res: any) => {
        try {
            const hours = parseInt(req.query.hours || "24", 10);
            const from_ts = Date.now() - hours * 60 * 60 * 1000;

            const [total, creates, updates, deletes] = await Promise.all([
                count_audit_logs({ from_ts }),
                count_audit_logs({ from_ts, action: "create" }),
                count_audit_logs({ from_ts, action: "update" }),
                count_audit_logs({ from_ts, action: "delete" }),
            ]);

            res.json({
                period_hours: hours,
                total_actions: total,
                by_action: {
                    create: creates,
                    update: updates,
                    delete: deletes,
                    other: total - creates - updates - deletes,
                },
            });
        } catch (e: any) {
            console.error("[audit] stats failed:", e);
            res.status(500).json({ err: "audit_stats_failed" });
        }
    });
}
