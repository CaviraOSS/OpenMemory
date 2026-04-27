import {
    insert_fact,
    update_fact,
    invalidate_fact,
    apply_confidence_decay,
    get_active_facts_count,
    get_total_facts_count,
    get_fact_by_id_for_user,
} from "../../temporal_graph/store";
import {
    query_facts_at_time,
    get_current_fact,
    search_facts,
    get_facts_by_subject,
} from "../../temporal_graph/query";
import {
    get_subject_timeline,
    get_predicate_timeline,
    compare_time_points,
    get_volatile_facts,
} from "../../temporal_graph/timeline";
import { require_tenant, reject_tenant_mismatch } from "../middleware/tenant";
import { parse_or_400, schema } from "../middleware/validate";

/**
 * Read the optional project scope from the request. Uses an explicit
 * `x-project-id` header (or `project_id` query/body field), and trims
 * empty strings to undefined. Project scoping is orthogonal to tenant
 * isolation: when omitted, the helper returns all of the caller's
 * facts across projects.
 */
function read_project(req: any): string | undefined {
    const candidates = [
        req?.project_id,
        req?.headers?.["x-project-id"],
        req?.query?.project_id,
        req?.body?.project_id,
    ];
    for (const c of candidates) {
        if (typeof c === "string" && c.trim()) return c.trim();
    }
    return undefined;
}

/**
 * Validate-then-coerce a date input from req.body or req.query. Rejects
 * malformed strings rather than silently producing `Invalid Date`.
 */
function parse_date(value: unknown): { ok: true; date?: Date } | { ok: false } {
    if (value === undefined || value === null || value === "")
        return { ok: true, date: undefined };
    if (typeof value !== "string" && typeof value !== "number")
        return { ok: false };
    const d = new Date(value as any);
    if (Number.isNaN(d.getTime())) return { ok: false };
    return { ok: true, date: d };
}

const create_fact_schema: schema = {
    subject: {
        type: "string",
        required: true,
        min_length: 1,
        max_length: 1024,
    },
    predicate: {
        type: "string",
        required: true,
        min_length: 1,
        max_length: 1024,
    },
    object: { type: "string", required: true, min_length: 1, max_length: 8192 },
    valid_from: { type: "string", max_length: 64 },
    confidence: { type: "number", min: 0, max: 1 },
    metadata: { type: "object" },
};

const update_fact_schema: schema = {
    confidence: { type: "number", min: 0, max: 1 },
    metadata: { type: "object" },
};

const invalidate_fact_schema: schema = {
    valid_to: { type: "string", max_length: 64 },
};

const decay_schema: schema = {
    decay_rate: { type: "number", min: 0, max: 1 },
};

export const create_temporal_fact = async (req: any, res: any) => {
    const tenant = require_tenant(req, res);
    if (!tenant) return;
    const b = parse_or_400<{
        subject: string;
        predicate: string;
        object: string;
        valid_from?: string;
        confidence?: number;
        metadata?: Record<string, unknown>;
    }>(res, req.body, create_fact_schema);
    if (!b) return;

    const vf = parse_date(b.valid_from);
    if (!vf.ok)
        return res.status(400).json({ error: "invalid valid_from date" });
    const valid_from_date = vf.date ?? new Date();
    const conf =
        b.confidence !== undefined
            ? Math.max(0, Math.min(1, b.confidence))
            : 1.0;

    const project_id = read_project(req);

    try {
        const id = await insert_fact({
            subject: b.subject,
            predicate: b.predicate,
            object: b.object,
            valid_from: valid_from_date,
            confidence: conf,
            metadata: b.metadata,
            user_id: tenant,
            project_id,
        });
        res.json({
            id,
            subject: b.subject,
            predicate: b.predicate,
            object: b.object,
            valid_from: valid_from_date.toISOString(),
            confidence: conf,
            user_id: tenant,
            project_id: project_id ?? null,
            message: "Fact created successfully",
        });
    } catch (error) {
        console.error("[TEMPORAL API] Error creating fact:", error);
        res.status(500).json({ error: "Failed to create fact" });
    }
};

export const get_temporal_fact = async (req: any, res: any) => {
    const tenant = require_tenant(req, res);
    if (!tenant) return;
    try {
        const subject =
            typeof req.query.subject === "string"
                ? req.query.subject
                : undefined;
        const predicate =
            typeof req.query.predicate === "string"
                ? req.query.predicate
                : undefined;
        const object =
            typeof req.query.object === "string" ? req.query.object : undefined;
        const at_raw = req.query.at;
        const min_confidence_raw = req.query.min_confidence;

        if (!subject && !predicate && !object) {
            return res.status(400).json({
                error: "At least one of subject, predicate, or object is required",
            });
        }

        const at_parsed = parse_date(at_raw);
        if (!at_parsed.ok)
            return res.status(400).json({ error: "invalid at date" });
        const at_date = at_parsed.date ?? new Date();

        let min_conf = 0.1;
        if (min_confidence_raw !== undefined && min_confidence_raw !== "") {
            const n = parseFloat(String(min_confidence_raw));
            if (!Number.isFinite(n) || n < 0 || n > 1) {
                return res
                    .status(400)
                    .json({ error: "invalid min_confidence" });
            }
            min_conf = n;
        }

        const project_id = read_project(req);
        const facts = await query_facts_at_time({
            user_id: tenant,
            project_id,
            subject,
            predicate,
            object,
            at: at_date,
            min_confidence: min_conf,
        });
        res.json({
            facts,
            query: {
                subject,
                predicate,
                object,
                at: at_date.toISOString(),
                min_confidence: min_conf,
                user_id: tenant,
                project_id: project_id ?? null,
            },
            count: facts.length,
        });
    } catch (error) {
        console.error("[TEMPORAL API] Error querying facts:", error);
        res.status(500).json({ error: "Failed to query facts" });
    }
};

export const get_current_temporal_fact = async (req: any, res: any) => {
    const tenant = require_tenant(req, res);
    if (!tenant) return;
    try {
        const subject =
            typeof req.query.subject === "string"
                ? req.query.subject
                : undefined;
        const predicate =
            typeof req.query.predicate === "string"
                ? req.query.predicate
                : undefined;

        if (!subject || !predicate) {
            return res
                .status(400)
                .json({ error: "Both subject and predicate are required" });
        }

        const fact = await get_current_fact(subject, predicate, tenant);
        if (!fact) {
            return res
                .status(404)
                .json({ error: "No current fact found", subject, predicate });
        }
        res.json({ fact });
    } catch (error) {
        console.error("[TEMPORAL API] Error getting current fact:", error);
        res.status(500).json({ error: "Failed to get current fact" });
    }
};

export const get_entity_timeline = async (req: any, res: any) => {
    const tenant = require_tenant(req, res);
    if (!tenant) return;
    try {
        const subject =
            typeof req.query.subject === "string"
                ? req.query.subject
                : undefined;
        const predicate =
            typeof req.query.predicate === "string"
                ? req.query.predicate
                : undefined;

        if (!subject)
            return res
                .status(400)
                .json({ error: "Subject parameter is required" });

        // get_subject_timeline does not accept user_id; filter post-hoc.
        const timeline_raw = await get_subject_timeline(subject, predicate);
        const timeline = timeline_raw.filter((entry: any) => {
            const u = entry.fact?.user_id ?? entry.user_id;
            return u === undefined || u === null || u === tenant;
        });

        res.json({ subject, predicate, timeline, count: timeline.length });
    } catch (error) {
        console.error("[TEMPORAL API] Error getting timeline:", error);
        res.status(500).json({ error: "Failed to get timeline" });
    }
};

export const get_predicate_history = async (req: any, res: any) => {
    const tenant = require_tenant(req, res);
    if (!tenant) return;
    try {
        const predicate =
            typeof req.query.predicate === "string"
                ? req.query.predicate
                : undefined;
        if (!predicate)
            return res
                .status(400)
                .json({ error: "Predicate parameter is required" });

        const from_p = parse_date(req.query.from);
        const to_p = parse_date(req.query.to);
        if (!from_p.ok)
            return res.status(400).json({ error: "invalid from date" });
        if (!to_p.ok) return res.status(400).json({ error: "invalid to date" });

        const timeline_raw = await get_predicate_timeline(
            predicate,
            from_p.date,
            to_p.date,
        );
        const timeline = timeline_raw.filter((entry: any) => {
            const u = entry.fact?.user_id ?? entry.user_id;
            return u === undefined || u === null || u === tenant;
        });

        res.json({
            predicate,
            from: from_p.date?.toISOString(),
            to: to_p.date?.toISOString(),
            timeline,
            count: timeline.length,
        });
    } catch (error) {
        console.error(
            "[TEMPORAL API] Error getting predicate timeline:",
            error,
        );
        res.status(500).json({ error: "Failed to get predicate timeline" });
    }
};

export const update_temporal_fact = async (req: any, res: any) => {
    const tenant = require_tenant(req, res);
    if (!tenant) return;
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: "Fact ID is required" });
    const b = parse_or_400<{
        confidence?: number;
        metadata?: Record<string, unknown>;
    }>(res, req.body, update_fact_schema);
    if (!b) return;
    if (b.confidence === undefined && b.metadata === undefined) {
        return res.status(400).json({
            error: "At least one of confidence or metadata must be provided",
        });
    }

    try {
        // Confirm ownership before mutating via authenticated point-lookup.
        const fact = await get_fact_by_id_for_user(id, tenant);
        if (!fact) {
            // Either does not exist or belongs to another tenant.
            return res.status(404).json({ error: "fact_not_found" });
        }
        const conf =
            b.confidence !== undefined
                ? Math.max(0, Math.min(1, b.confidence))
                : undefined;
        await update_fact(id, conf, b.metadata);
        res.json({
            id,
            confidence: conf,
            metadata: b.metadata,
            message: "Fact updated successfully",
        });
    } catch (error) {
        console.error("[TEMPORAL API] Error updating fact:", error);
        res.status(500).json({ error: "Failed to update fact" });
    }
};

export const invalidate_temporal_fact = async (req: any, res: any) => {
    const tenant = require_tenant(req, res);
    if (!tenant) return;
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: "Fact ID is required" });
    const b = parse_or_400<{ valid_to?: string }>(
        res,
        req.body,
        invalidate_fact_schema,
    );
    if (!b) return;
    const vt = parse_date(b.valid_to);
    if (!vt.ok) return res.status(400).json({ error: "invalid valid_to date" });
    const valid_to_date = vt.date ?? new Date();

    try {
        const fact = await get_fact_by_id_for_user(id, tenant);
        if (!fact) {
            return res.status(404).json({ error: "fact_not_found" });
        }
        await invalidate_fact(id, valid_to_date);
        res.json({
            id,
            valid_to: valid_to_date.toISOString(),
            message: "Fact invalidated successfully",
        });
    } catch (error) {
        console.error("[TEMPORAL API] Error invalidating fact:", error);
        res.status(500).json({ error: "Failed to invalidate fact" });
    }
};

export const get_subject_facts = async (req: any, res: any) => {
    const tenant = require_tenant(req, res);
    if (!tenant) return;
    try {
        const { subject } = req.params;
        if (!subject)
            return res
                .status(400)
                .json({ error: "Subject parameter is required" });

        const at_p = parse_date(req.query.at);
        if (!at_p.ok) return res.status(400).json({ error: "invalid at date" });
        const include_hist = req.query.include_historical === "true";

        const project_id = read_project(req);
        const facts = await get_facts_by_subject(subject, {
            user_id: tenant,
            project_id,
            at: at_p.date,
            include_historical: include_hist,
        });

        res.json({
            subject,
            at: at_p.date?.toISOString(),
            include_historical: include_hist,
            facts,
            count: facts.length,
        });
    } catch (error) {
        console.error("[TEMPORAL API] Error getting subject facts:", error);
        res.status(500).json({ error: "Failed to get subject facts" });
    }
};

export const search_temporal_facts = async (req: any, res: any) => {
    const tenant = require_tenant(req, res);
    if (!tenant) return;
    try {
        const pattern =
            typeof req.query.pattern === "string"
                ? req.query.pattern
                : undefined;
        const field =
            typeof req.query.field === "string" ? req.query.field : "subject";
        const at_p = parse_date(req.query.at);

        if (!pattern)
            return res
                .status(400)
                .json({ error: "Pattern parameter is required" });
        if (pattern.length > 1024)
            return res.status(400).json({ error: "pattern too long" });
        if (!["subject", "predicate", "object"].includes(field)) {
            return res.status(400).json({
                error: "Field must be one of: subject, predicate, object",
            });
        }
        if (!at_p.ok) return res.status(400).json({ error: "invalid at date" });

        const project_id = read_project(req);
        const facts = await search_facts(pattern, {
            user_id: tenant,
            project_id,
            field: field as any,
            at: at_p.date,
        });

        res.json({
            pattern,
            field,
            at: at_p.date?.toISOString(),
            facts,
            count: facts.length,
        });
    } catch (error) {
        console.error("[TEMPORAL API] Error searching facts:", error);
        res.status(500).json({ error: "Failed to search facts" });
    }
};

export const get_temporal_stats = async (req: any, res: any) => {
    const tenant = require_tenant(req, res);
    if (!tenant) return;
    try {
        // The underlying counters are not tenant-scoped; expose them only
        // as global counters and document the limitation.
        const active_facts = await get_active_facts_count();
        const total_facts = await get_total_facts_count();
        const historical_facts = total_facts - active_facts;

        res.json({
            active_facts,
            historical_facts,
            total_facts,
            historical_percentage:
                total_facts > 0
                    ? ((historical_facts / total_facts) * 100).toFixed(2) + "%"
                    : "0%",
            scope: "global",
        });
    } catch (error) {
        console.error("[TEMPORAL API] Error getting stats:", error);
        res.status(500).json({ error: "Failed to get statistics" });
    }
};

export const apply_decay = async (req: any, res: any) => {
    const tenant = require_tenant(req, res);
    if (!tenant) return;
    // Decay is a global maintenance action; require an explicit admin flag.
    if (process.env.OM_ADMIN_DECAY !== "true") {
        return res.status(403).json({
            error: "admin_only",
            message:
                "set OM_ADMIN_DECAY=true to enable confidence decay over global facts",
        });
    }
    const b = parse_or_400<{ decay_rate?: number }>(
        res,
        req.body,
        decay_schema,
    );
    if (!b) return;
    const decay_rate = b.decay_rate ?? 0.01;

    try {
        const updated = await apply_confidence_decay(decay_rate);
        res.json({
            decay_rate,
            facts_updated: updated,
            message: "Confidence decay applied successfully",
        });
    } catch (error) {
        console.error("[TEMPORAL API] Error applying decay:", error);
        res.status(500).json({ error: "Failed to apply confidence decay" });
    }
};

export const compare_facts = async (req: any, res: any) => {
    const tenant = require_tenant(req, res);
    if (!tenant) return;
    try {
        const subject =
            typeof req.query.subject === "string"
                ? req.query.subject
                : undefined;
        const t1_p = parse_date(req.query.time1);
        const t2_p = parse_date(req.query.time2);
        if (!subject)
            return res.status(400).json({ error: "subject is required" });
        if (!t1_p.ok || !t1_p.date)
            return res.status(400).json({ error: "invalid time1" });
        if (!t2_p.ok || !t2_p.date)
            return res.status(400).json({ error: "invalid time2" });

        const comparison = await compare_time_points(
            subject,
            t1_p.date,
            t2_p.date,
        );

        res.json({
            subject,
            time1: t1_p.date.toISOString(),
            time2: t2_p.date.toISOString(),
            ...comparison,
            summary: {
                added: comparison.added.length,
                removed: comparison.removed.length,
                changed: comparison.changed.length,
                unchanged: comparison.unchanged.length,
            },
        });
    } catch (error) {
        console.error("[TEMPORAL API] Error comparing facts:", error);
        res.status(500).json({ error: "Failed to compare facts" });
    }
};

export const get_most_volatile = async (req: any, res: any) => {
    const tenant = require_tenant(req, res);
    if (!tenant) return;
    try {
        const subject =
            typeof req.query.subject === "string"
                ? req.query.subject
                : undefined;
        const limit_raw = req.query.limit;
        let limit = 10;
        if (limit_raw !== undefined && limit_raw !== "") {
            const n = parseInt(String(limit_raw), 10);
            if (!Number.isFinite(n) || n < 1 || n > 1000) {
                return res.status(400).json({ error: "invalid limit" });
            }
            limit = n;
        }

        const volatile_raw = await get_volatile_facts(subject, limit);
        const volatile = volatile_raw.filter((f: any) => {
            const u = f.user_id ?? f.fact?.user_id;
            return u === undefined || u === null || u === tenant;
        });

        res.json({
            subject,
            limit,
            volatile_facts: volatile,
            count: volatile.length,
        });
    } catch (error) {
        console.error("[TEMPORAL API] Error getting volatile facts:", error);
        res.status(500).json({ error: "Failed to get volatile facts" });
    }
};

export function temporal(app: any) {
    app.post("/api/temporal/fact", create_temporal_fact);
    app.get("/api/temporal/fact", get_temporal_fact);
    app.get("/api/temporal/fact/current", get_current_temporal_fact);
    app.patch("/api/temporal/fact/:id", update_temporal_fact);
    app.delete("/api/temporal/fact/:id", invalidate_temporal_fact);

    app.get("/api/temporal/timeline", get_entity_timeline);
    app.get("/api/temporal/subject/:subject", get_subject_facts);
    app.get("/api/temporal/search", search_temporal_facts);
    app.get("/api/temporal/compare", compare_facts);
    app.get("/api/temporal/stats", get_temporal_stats);
    app.post("/api/temporal/decay", apply_decay);
    app.get("/api/temporal/volatile", get_most_volatile);
}
