/**
 * Compliance Rules Engine API Routes (D7)
 *
 * Provides endpoints for managing compliance rules and running checks.
 */

import {
    create_rule,
    get_rule,
    list_rules,
    update_rule,
    delete_rule,
    check_compliance,
    create_rule_set,
    get_rule_set,
    list_rule_sets,
    check_with_rule_set,
    COMMON_RULES,
    type RuleType,
    type Severity,
} from "../../core/compliance";
import { audit_log } from "../../core/audit";

export function compliance(app: any) {
    /**
     * GET /compliance/rules
     *
     * List compliance rules with optional filtering.
     */
    app.get("/compliance/rules", async (req: any, res: any) => {
        try {
            const { category, type, enabled, limit, offset } = req.query;

            const result = await list_rules({
                category,
                type: type as RuleType,
                enabled: enabled === "true" ? true : enabled === "false" ? false : undefined,
                limit: limit ? parseInt(limit, 10) : undefined,
                offset: offset ? parseInt(offset, 10) : undefined,
            });

            res.json({
                rules: result.rules.map(r => ({
                    id: r.id,
                    name: r.name,
                    description: r.description,
                    type: r.type,
                    severity: r.severity,
                    category: r.category,
                    enabled: r.enabled,
                    updated_at: r.updated_at,
                })),
                total: result.total,
            });
        } catch (e: any) {
            console.error("[compliance] list rules failed:", e);
            res.status(500).json({ err: "list_rules_failed" });
        }
    });

    /**
     * GET /compliance/rules/:id
     *
     * Get a specific rule with full configuration.
     */
    app.get("/compliance/rules/:id", async (req: any, res: any) => {
        try {
            const { id } = req.params;
            const rule = await get_rule(id);

            if (!rule) {
                return res.status(404).json({ err: "rule_not_found" });
            }

            res.json(rule);
        } catch (e: any) {
            console.error("[compliance] get rule failed:", e);
            res.status(500).json({ err: "get_rule_failed" });
        }
    });

    /**
     * POST /compliance/rules
     *
     * Create a new compliance rule.
     */
    app.post("/compliance/rules", async (req: any, res: any) => {
        try {
            const {
                name,
                type,
                severity,
                config,
                description,
                category,
                enabled,
                user_id,
            } = req.body || {};

            if (!name || !type || !severity || !config) {
                return res.status(400).json({ err: "missing_required_fields" });
            }

            const validTypes: RuleType[] = [
                "required_clause",
                "prohibited_term",
                "required_field",
                "pattern_match",
                "field_format",
                "word_count",
                "date_range",
            ];
            if (!validTypes.includes(type)) {
                return res.status(400).json({ err: "invalid_rule_type" });
            }

            const validSeverities: Severity[] = ["error", "warning", "info"];
            if (!validSeverities.includes(severity)) {
                return res.status(400).json({ err: "invalid_severity" });
            }

            const rule = await create_rule(name, type, severity, config, {
                description,
                category,
                enabled,
            });

            res.json({
                ok: true,
                rule: {
                    id: rule.id,
                    name: rule.name,
                    type: rule.type,
                    severity: rule.severity,
                },
            });

            // Audit log
            audit_log("compliance_rule", rule.id, "create", {
                actor_id: user_id,
                metadata: { name, type, severity },
            }).catch(e => console.error("[audit] log failed:", e));
        } catch (e: any) {
            console.error("[compliance] create rule failed:", e);
            res.status(500).json({ err: "create_rule_failed" });
        }
    });

    /**
     * PUT /compliance/rules/:id
     *
     * Update an existing rule.
     */
    app.put("/compliance/rules/:id", async (req: any, res: any) => {
        try {
            const { id } = req.params;
            const { name, description, severity, config, category, enabled, user_id } = req.body || {};

            const rule = await update_rule(id, {
                name,
                description,
                severity,
                config,
                category,
                enabled,
            });

            if (!rule) {
                return res.status(404).json({ err: "rule_not_found" });
            }

            res.json({
                ok: true,
                rule: {
                    id: rule.id,
                    name: rule.name,
                    type: rule.type,
                    enabled: rule.enabled,
                },
            });

            // Audit log
            audit_log("compliance_rule", id, "update", {
                actor_id: user_id,
                changes: { name, severity, enabled },
            }).catch(e => console.error("[audit] log failed:", e));
        } catch (e: any) {
            console.error("[compliance] update rule failed:", e);
            res.status(500).json({ err: "update_rule_failed" });
        }
    });

    /**
     * DELETE /compliance/rules/:id
     *
     * Delete a rule.
     */
    app.delete("/compliance/rules/:id", async (req: any, res: any) => {
        try {
            const { id } = req.params;
            const { user_id } = req.body || {};

            const rule = await get_rule(id);
            if (!rule) {
                return res.status(404).json({ err: "rule_not_found" });
            }

            await delete_rule(id);

            res.json({
                ok: true,
                deleted: id,
            });

            // Audit log
            audit_log("compliance_rule", id, "delete", {
                actor_id: user_id,
                metadata: { name: rule.name },
            }).catch(e => console.error("[audit] log failed:", e));
        } catch (e: any) {
            console.error("[compliance] delete rule failed:", e);
            res.status(500).json({ err: "delete_rule_failed" });
        }
    });

    /**
     * POST /compliance/check
     *
     * Run compliance check against content.
     */
    app.post("/compliance/check", async (req: any, res: any) => {
        try {
            const { content, rule_ids, category, memory_id, metadata } = req.body || {};

            if (!content) {
                return res.status(400).json({ err: "missing_content" });
            }

            const report = await check_compliance(content, {
                rule_ids,
                category,
                memory_id,
                metadata,
            });

            res.json(report);
        } catch (e: any) {
            console.error("[compliance] check failed:", e);
            res.status(500).json({ err: "compliance_check_failed" });
        }
    });

    /**
     * GET /compliance/rule-sets
     *
     * List rule sets.
     */
    app.get("/compliance/rule-sets", async (req: any, res: any) => {
        try {
            const { category, limit, offset } = req.query;

            const result = await list_rule_sets({
                category,
                limit: limit ? parseInt(limit, 10) : undefined,
                offset: offset ? parseInt(offset, 10) : undefined,
            });

            res.json({
                rule_sets: result.rule_sets.map(rs => ({
                    id: rs.id,
                    name: rs.name,
                    description: rs.description,
                    rule_count: rs.rules.length,
                    category: rs.category,
                    updated_at: rs.updated_at,
                })),
                total: result.total,
            });
        } catch (e: any) {
            console.error("[compliance] list rule sets failed:", e);
            res.status(500).json({ err: "list_rule_sets_failed" });
        }
    });

    /**
     * GET /compliance/rule-sets/:id
     *
     * Get a specific rule set.
     */
    app.get("/compliance/rule-sets/:id", async (req: any, res: any) => {
        try {
            const { id } = req.params;
            const ruleSet = await get_rule_set(id);

            if (!ruleSet) {
                return res.status(404).json({ err: "rule_set_not_found" });
            }

            res.json(ruleSet);
        } catch (e: any) {
            console.error("[compliance] get rule set failed:", e);
            res.status(500).json({ err: "get_rule_set_failed" });
        }
    });

    /**
     * POST /compliance/rule-sets
     *
     * Create a new rule set.
     */
    app.post("/compliance/rule-sets", async (req: any, res: any) => {
        try {
            const { name, rule_ids, description, category, user_id } = req.body || {};

            if (!name || !rule_ids || !Array.isArray(rule_ids)) {
                return res.status(400).json({ err: "missing_name_or_rule_ids" });
            }

            const ruleSet = await create_rule_set(name, rule_ids, {
                description,
                category,
            });

            res.json({
                ok: true,
                rule_set: {
                    id: ruleSet.id,
                    name: ruleSet.name,
                    rule_count: ruleSet.rules.length,
                },
            });

            // Audit log
            audit_log("rule_set", ruleSet.id, "create", {
                actor_id: user_id,
                metadata: { name, rule_count: rule_ids.length },
            }).catch(e => console.error("[audit] log failed:", e));
        } catch (e: any) {
            console.error("[compliance] create rule set failed:", e);
            res.status(500).json({ err: "create_rule_set_failed" });
        }
    });

    /**
     * POST /compliance/rule-sets/:id/check
     *
     * Run compliance check using a rule set.
     */
    app.post("/compliance/rule-sets/:id/check", async (req: any, res: any) => {
        try {
            const { id } = req.params;
            const { content, memory_id, metadata } = req.body || {};

            if (!content) {
                return res.status(400).json({ err: "missing_content" });
            }

            const report = await check_with_rule_set(content, id, {
                memory_id,
                metadata,
            });

            res.json(report);
        } catch (e: any) {
            if (e.message?.includes("not found")) {
                return res.status(404).json({ err: "rule_set_not_found" });
            }
            console.error("[compliance] rule set check failed:", e);
            res.status(500).json({ err: "rule_set_check_failed" });
        }
    });

    /**
     * GET /compliance/common-rules
     *
     * Get list of pre-built common rules that can be created.
     */
    app.get("/compliance/common-rules", async (_req: any, res: any) => {
        try {
            res.json({
                common_rules: Object.entries(COMMON_RULES).map(([key, rule]) => ({
                    key,
                    name: rule.name,
                    type: rule.type,
                    severity: rule.severity,
                    description: `Pre-built rule: ${rule.name}`,
                })),
            });
        } catch (e: any) {
            console.error("[compliance] common rules failed:", e);
            res.status(500).json({ err: "common_rules_failed" });
        }
    });

    /**
     * POST /compliance/common-rules/:key
     *
     * Create a rule from a common rule template.
     */
    app.post("/compliance/common-rules/:key", async (req: any, res: any) => {
        try {
            const { key } = req.params;
            const { category, user_id } = req.body || {};

            const commonRule = (COMMON_RULES as any)[key];
            if (!commonRule) {
                return res.status(404).json({ err: "common_rule_not_found" });
            }

            const rule = await create_rule(
                commonRule.name,
                commonRule.type,
                commonRule.severity,
                commonRule.config,
                { category }
            );

            res.json({
                ok: true,
                rule: {
                    id: rule.id,
                    name: rule.name,
                    type: rule.type,
                    severity: rule.severity,
                },
            });

            // Audit log
            audit_log("compliance_rule", rule.id, "create", {
                actor_id: user_id,
                metadata: { source: "common_rule", key },
            }).catch(e => console.error("[audit] log failed:", e));
        } catch (e: any) {
            console.error("[compliance] create from common failed:", e);
            res.status(500).json({ err: "create_common_rule_failed" });
        }
    });
}
