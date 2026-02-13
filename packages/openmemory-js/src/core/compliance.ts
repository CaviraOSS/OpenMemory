/**
 * Compliance Rules Engine (D7)
 *
 * Deterministic rule checking for document compliance with support for:
 * - Required clause detection
 * - Prohibited term detection
 * - Required field validation
 * - Pattern-based checks
 *
 * All checks are reproducible and deterministic (no LLM involvement).
 */

import { randomUUID } from "crypto";
import { run_async, get_async, all_async } from "./db";

export type RuleType =
    | "required_clause"
    | "prohibited_term"
    | "required_field"
    | "pattern_match"
    | "field_format"
    | "word_count"
    | "date_range";

export type Severity = "error" | "warning" | "info";

export interface ComplianceRule {
    id: string;
    name: string;
    description?: string;
    type: RuleType;
    severity: Severity;
    config: RuleConfig;
    category?: string;
    enabled: boolean;
    created_at: number;
    updated_at: number;
}

export interface RuleConfig {
    // For required_clause: patterns that must be present
    required_patterns?: string[];

    // For prohibited_term: patterns that must NOT be present
    prohibited_patterns?: string[];

    // For required_field: metadata fields that must exist
    required_fields?: string[];

    // For pattern_match: custom regex to match
    pattern?: string;
    pattern_flags?: string;
    must_match?: boolean; // true = must match, false = must NOT match

    // For field_format: field name and expected format
    field_name?: string;
    format_pattern?: string;

    // For word_count: min/max word count
    min_words?: number;
    max_words?: number;

    // For date_range: field and range
    date_field?: string;
    min_date?: string;
    max_date?: string;

    // Case sensitivity
    case_insensitive?: boolean;
}

export interface RuleViolation {
    rule_id: string;
    rule_name: string;
    rule_type: RuleType;
    severity: Severity;
    message: string;
    context?: string;
    location?: {
        start?: number;
        end?: number;
        line?: number;
    };
}

export interface ComplianceReport {
    id: string;
    memory_id?: string;
    content_hash: string;
    rules_checked: number;
    violations: RuleViolation[];
    passed: boolean;
    error_count: number;
    warning_count: number;
    info_count: number;
    checked_at: number;
    duration_ms: number;
}

export interface RuleSet {
    id: string;
    name: string;
    description?: string;
    rules: string[]; // Rule IDs
    category?: string;
    created_at: number;
    updated_at: number;
}

// Database operations
const is_pg = process.env.OM_METADATA_BACKEND === "postgres";
const sc = process.env.OM_PG_SCHEMA || "public";

/**
 * Create a new compliance rule
 */
export async function create_rule(
    name: string,
    type: RuleType,
    severity: Severity,
    config: RuleConfig,
    options: {
        description?: string;
        category?: string;
        enabled?: boolean;
    } = {}
): Promise<ComplianceRule> {
    const id = randomUUID();
    const now = Date.now();

    const rule: ComplianceRule = {
        id,
        name,
        description: options.description,
        type,
        severity,
        config,
        category: options.category,
        enabled: options.enabled !== false,
        created_at: now,
        updated_at: now,
    };

    const sql = is_pg
        ? `INSERT INTO "${sc}"."openmemory_compliance_rules"(id, name, description, type, severity, config, category, enabled, created_at, updated_at)
           VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`
        : `INSERT INTO compliance_rules(id, name, description, type, severity, config, category, enabled, created_at, updated_at)
           VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    await run_async(sql, [
        id,
        name,
        options.description,
        type,
        severity,
        JSON.stringify(config),
        options.category,
        options.enabled !== false ? 1 : 0,
        now,
        now,
    ]);

    return rule;
}

/**
 * Get a rule by ID
 */
export async function get_rule(id: string): Promise<ComplianceRule | null> {
    const sql = is_pg
        ? `SELECT * FROM "${sc}"."openmemory_compliance_rules" WHERE id = $1`
        : `SELECT * FROM compliance_rules WHERE id = ?`;

    const row = await get_async(sql, [id]);
    if (!row) return null;

    return {
        ...row,
        config: typeof row.config === "string" ? JSON.parse(row.config) : row.config,
        enabled: !!row.enabled,
    };
}

/**
 * List rules with optional filtering
 */
export async function list_rules(options: {
    category?: string;
    type?: RuleType;
    enabled?: boolean;
    limit?: number;
    offset?: number;
} = {}): Promise<{ rules: ComplianceRule[]; total: number }> {
    const { category, type, enabled, limit = 50, offset = 0 } = options;

    let sql: string;
    let count_sql: string;
    const params: any[] = [];

    if (is_pg) {
        sql = `SELECT * FROM "${sc}"."openmemory_compliance_rules"`;
        count_sql = `SELECT COUNT(*) as total FROM "${sc}"."openmemory_compliance_rules"`;

        const conditions: string[] = [];
        if (category) {
            conditions.push(`category = $${params.length + 1}`);
            params.push(category);
        }
        if (type) {
            conditions.push(`type = $${params.length + 1}`);
            params.push(type);
        }
        if (enabled !== undefined) {
            conditions.push(`enabled = $${params.length + 1}`);
            params.push(enabled ? 1 : 0);
        }

        if (conditions.length > 0) {
            sql += ` WHERE ${conditions.join(" AND ")}`;
            count_sql += ` WHERE ${conditions.join(" AND ")}`;
        }

        sql += ` ORDER BY name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);
    } else {
        sql = `SELECT * FROM compliance_rules`;
        count_sql = `SELECT COUNT(*) as total FROM compliance_rules`;

        const conditions: string[] = [];
        if (category) {
            conditions.push(`category = ?`);
            params.push(category);
        }
        if (type) {
            conditions.push(`type = ?`);
            params.push(type);
        }
        if (enabled !== undefined) {
            conditions.push(`enabled = ?`);
            params.push(enabled ? 1 : 0);
        }

        if (conditions.length > 0) {
            sql += ` WHERE ${conditions.join(" AND ")}`;
            count_sql += ` WHERE ${conditions.join(" AND ")}`;
        }

        sql += ` ORDER BY name ASC LIMIT ? OFFSET ?`;
        params.push(limit, offset);
    }

    const [rows, count_row] = await Promise.all([
        all_async(sql, params),
        get_async(count_sql, params.slice(0, -2)),
    ]);

    return {
        rules: rows.map(row => ({
            ...row,
            config: typeof row.config === "string" ? JSON.parse(row.config) : row.config,
            enabled: !!row.enabled,
        })),
        total: count_row?.total || 0,
    };
}

/**
 * Update a rule
 */
export async function update_rule(
    id: string,
    updates: Partial<Pick<ComplianceRule, "name" | "description" | "severity" | "config" | "category" | "enabled">>
): Promise<ComplianceRule | null> {
    const existing = await get_rule(id);
    if (!existing) return null;

    const now = Date.now();
    const updated = {
        ...existing,
        ...updates,
        updated_at: now,
    };

    const sql = is_pg
        ? `UPDATE "${sc}"."openmemory_compliance_rules"
           SET name = $1, description = $2, severity = $3, config = $4, category = $5, enabled = $6, updated_at = $7
           WHERE id = $8`
        : `UPDATE compliance_rules
           SET name = ?, description = ?, severity = ?, config = ?, category = ?, enabled = ?, updated_at = ?
           WHERE id = ?`;

    await run_async(sql, [
        updated.name,
        updated.description,
        updated.severity,
        JSON.stringify(updated.config),
        updated.category,
        updated.enabled ? 1 : 0,
        now,
        id,
    ]);

    return updated;
}

/**
 * Delete a rule
 */
export async function delete_rule(id: string): Promise<boolean> {
    const sql = is_pg
        ? `DELETE FROM "${sc}"."openmemory_compliance_rules" WHERE id = $1`
        : `DELETE FROM compliance_rules WHERE id = ?`;

    await run_async(sql, [id]);
    return true;
}

/**
 * Evaluate a single rule against content
 */
export function evaluate_rule(
    rule: ComplianceRule,
    content: string,
    metadata?: Record<string, any>
): RuleViolation[] {
    const violations: RuleViolation[] = [];
    const cfg = rule.config;
    const flags = cfg.case_insensitive ? "gi" : "g";

    switch (rule.type) {
        case "required_clause": {
            for (const pattern of cfg.required_patterns || []) {
                const regex = new RegExp(pattern, flags);
                if (!regex.test(content)) {
                    violations.push({
                        rule_id: rule.id,
                        rule_name: rule.name,
                        rule_type: rule.type,
                        severity: rule.severity,
                        message: `Required clause not found: "${pattern}"`,
                    });
                }
            }
            break;
        }

        case "prohibited_term": {
            for (const pattern of cfg.prohibited_patterns || []) {
                const regex = new RegExp(pattern, flags);
                const match = regex.exec(content);
                if (match) {
                    violations.push({
                        rule_id: rule.id,
                        rule_name: rule.name,
                        rule_type: rule.type,
                        severity: rule.severity,
                        message: `Prohibited term found: "${match[0]}"`,
                        context: content.substring(
                            Math.max(0, match.index - 30),
                            Math.min(content.length, match.index + match[0].length + 30)
                        ),
                        location: {
                            start: match.index,
                            end: match.index + match[0].length,
                        },
                    });
                }
            }
            break;
        }

        case "required_field": {
            for (const field of cfg.required_fields || []) {
                const value = metadata?.[field];
                if (value === undefined || value === null || value === "") {
                    violations.push({
                        rule_id: rule.id,
                        rule_name: rule.name,
                        rule_type: rule.type,
                        severity: rule.severity,
                        message: `Required metadata field missing: "${field}"`,
                    });
                }
            }
            break;
        }

        case "pattern_match": {
            if (cfg.pattern) {
                const regex = new RegExp(cfg.pattern, cfg.pattern_flags || flags);
                const matches = regex.test(content);

                if (cfg.must_match && !matches) {
                    violations.push({
                        rule_id: rule.id,
                        rule_name: rule.name,
                        rule_type: rule.type,
                        severity: rule.severity,
                        message: `Required pattern not found: "${cfg.pattern}"`,
                    });
                } else if (!cfg.must_match && matches) {
                    const match = content.match(regex);
                    violations.push({
                        rule_id: rule.id,
                        rule_name: rule.name,
                        rule_type: rule.type,
                        severity: rule.severity,
                        message: `Prohibited pattern found: "${match?.[0] || cfg.pattern}"`,
                    });
                }
            }
            break;
        }

        case "field_format": {
            if (cfg.field_name && cfg.format_pattern) {
                const value = metadata?.[cfg.field_name];
                if (value !== undefined && value !== null) {
                    const regex = new RegExp(cfg.format_pattern);
                    if (!regex.test(String(value))) {
                        violations.push({
                            rule_id: rule.id,
                            rule_name: rule.name,
                            rule_type: rule.type,
                            severity: rule.severity,
                            message: `Field "${cfg.field_name}" has invalid format: "${value}"`,
                        });
                    }
                }
            }
            break;
        }

        case "word_count": {
            const words = content.trim().split(/\s+/).filter(Boolean);
            const count = words.length;

            if (cfg.min_words !== undefined && count < cfg.min_words) {
                violations.push({
                    rule_id: rule.id,
                    rule_name: rule.name,
                    rule_type: rule.type,
                    severity: rule.severity,
                    message: `Word count too low: ${count} (minimum: ${cfg.min_words})`,
                });
            }
            if (cfg.max_words !== undefined && count > cfg.max_words) {
                violations.push({
                    rule_id: rule.id,
                    rule_name: rule.name,
                    rule_type: rule.type,
                    severity: rule.severity,
                    message: `Word count too high: ${count} (maximum: ${cfg.max_words})`,
                });
            }
            break;
        }

        case "date_range": {
            if (cfg.date_field) {
                const value = metadata?.[cfg.date_field];
                if (value) {
                    const date = new Date(value);
                    if (!isNaN(date.getTime())) {
                        if (cfg.min_date) {
                            const minDate = new Date(cfg.min_date);
                            if (date < minDate) {
                                violations.push({
                                    rule_id: rule.id,
                                    rule_name: rule.name,
                                    rule_type: rule.type,
                                    severity: rule.severity,
                                    message: `Date "${cfg.date_field}" is before minimum: ${value} < ${cfg.min_date}`,
                                });
                            }
                        }
                        if (cfg.max_date) {
                            const maxDate = new Date(cfg.max_date);
                            if (date > maxDate) {
                                violations.push({
                                    rule_id: rule.id,
                                    rule_name: rule.name,
                                    rule_type: rule.type,
                                    severity: rule.severity,
                                    message: `Date "${cfg.date_field}" is after maximum: ${value} > ${cfg.max_date}`,
                                });
                            }
                        }
                    }
                }
            }
            break;
        }
    }

    return violations;
}

/**
 * Run compliance check against content with specified rules
 */
export async function check_compliance(
    content: string,
    options: {
        rule_ids?: string[];
        category?: string;
        memory_id?: string;
        metadata?: Record<string, any>;
    } = {}
): Promise<ComplianceReport> {
    const start = Date.now();
    const { createHash } = await import("crypto");
    const content_hash = createHash("sha256").update(content).digest("hex").substring(0, 16);

    // Get rules to check
    let rules: ComplianceRule[];
    if (options.rule_ids && options.rule_ids.length > 0) {
        const rulePromises = options.rule_ids.map(id => get_rule(id));
        const ruleResults = await Promise.all(rulePromises);
        rules = ruleResults.filter((r): r is ComplianceRule => r !== null && r.enabled);
    } else {
        const result = await list_rules({
            category: options.category,
            enabled: true,
            limit: 1000,
        });
        rules = result.rules;
    }

    // Evaluate all rules
    const violations: RuleViolation[] = [];
    for (const rule of rules) {
        const ruleViolations = evaluate_rule(rule, content, options.metadata);
        violations.push(...ruleViolations);
    }

    // Count by severity
    const error_count = violations.filter(v => v.severity === "error").length;
    const warning_count = violations.filter(v => v.severity === "warning").length;
    const info_count = violations.filter(v => v.severity === "info").length;

    const report: ComplianceReport = {
        id: randomUUID(),
        memory_id: options.memory_id,
        content_hash,
        rules_checked: rules.length,
        violations,
        passed: error_count === 0,
        error_count,
        warning_count,
        info_count,
        checked_at: Date.now(),
        duration_ms: Date.now() - start,
    };

    return report;
}

/**
 * Create a rule set (collection of rules)
 */
export async function create_rule_set(
    name: string,
    rule_ids: string[],
    options: {
        description?: string;
        category?: string;
    } = {}
): Promise<RuleSet> {
    const id = randomUUID();
    const now = Date.now();

    const ruleSet: RuleSet = {
        id,
        name,
        description: options.description,
        rules: rule_ids,
        category: options.category,
        created_at: now,
        updated_at: now,
    };

    const sql = is_pg
        ? `INSERT INTO "${sc}"."openmemory_rule_sets"(id, name, description, rules, category, created_at, updated_at)
           VALUES($1, $2, $3, $4, $5, $6, $7)`
        : `INSERT INTO rule_sets(id, name, description, rules, category, created_at, updated_at)
           VALUES(?, ?, ?, ?, ?, ?, ?)`;

    await run_async(sql, [
        id,
        name,
        options.description,
        JSON.stringify(rule_ids),
        options.category,
        now,
        now,
    ]);

    return ruleSet;
}

/**
 * Get a rule set by ID
 */
export async function get_rule_set(id: string): Promise<RuleSet | null> {
    const sql = is_pg
        ? `SELECT * FROM "${sc}"."openmemory_rule_sets" WHERE id = $1`
        : `SELECT * FROM rule_sets WHERE id = ?`;

    const row = await get_async(sql, [id]);
    if (!row) return null;

    return {
        ...row,
        rules: typeof row.rules === "string" ? JSON.parse(row.rules) : row.rules,
    };
}

/**
 * List rule sets
 */
export async function list_rule_sets(options: {
    category?: string;
    limit?: number;
    offset?: number;
} = {}): Promise<{ rule_sets: RuleSet[]; total: number }> {
    const { category, limit = 50, offset = 0 } = options;

    let sql: string;
    let count_sql: string;
    const params: any[] = [];

    if (is_pg) {
        sql = `SELECT * FROM "${sc}"."openmemory_rule_sets"`;
        count_sql = `SELECT COUNT(*) as total FROM "${sc}"."openmemory_rule_sets"`;

        if (category) {
            sql += ` WHERE category = $1`;
            count_sql += ` WHERE category = $1`;
            params.push(category);
        }

        sql += ` ORDER BY name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);
    } else {
        sql = `SELECT * FROM rule_sets`;
        count_sql = `SELECT COUNT(*) as total FROM rule_sets`;

        if (category) {
            sql += ` WHERE category = ?`;
            count_sql += ` WHERE category = ?`;
            params.push(category);
        }

        sql += ` ORDER BY name ASC LIMIT ? OFFSET ?`;
        params.push(limit, offset);
    }

    const [rows, count_row] = await Promise.all([
        all_async(sql, params),
        get_async(count_sql, params.slice(0, -2)),
    ]);

    return {
        rule_sets: rows.map(row => ({
            ...row,
            rules: typeof row.rules === "string" ? JSON.parse(row.rules) : row.rules,
        })),
        total: count_row?.total || 0,
    };
}

/**
 * Check compliance using a rule set
 */
export async function check_with_rule_set(
    content: string,
    rule_set_id: string,
    options: {
        memory_id?: string;
        metadata?: Record<string, any>;
    } = {}
): Promise<ComplianceReport> {
    const ruleSet = await get_rule_set(rule_set_id);
    if (!ruleSet) {
        throw new Error(`Rule set not found: ${rule_set_id}`);
    }

    return check_compliance(content, {
        rule_ids: ruleSet.rules,
        memory_id: options.memory_id,
        metadata: options.metadata,
    });
}

// Pre-built common rules
export const COMMON_RULES = {
    CONFIDENTIALITY_CLAUSE: {
        name: "Confidentiality Clause Required",
        type: "required_clause" as RuleType,
        severity: "error" as Severity,
        config: {
            required_patterns: [
                "confidential",
                "non-disclosure|nda|confidentiality agreement",
            ],
            case_insensitive: true,
        },
    },
    NO_PROFANITY: {
        name: "No Profanity",
        type: "prohibited_term" as RuleType,
        severity: "error" as Severity,
        config: {
            prohibited_patterns: [
                "\\b(damn|hell|crap)\\b",
            ],
            case_insensitive: true,
        },
    },
    EFFECTIVE_DATE_REQUIRED: {
        name: "Effective Date Required",
        type: "required_field" as RuleType,
        severity: "error" as Severity,
        config: {
            required_fields: ["effective_date"],
        },
    },
    MIN_WORD_COUNT: {
        name: "Minimum Word Count",
        type: "word_count" as RuleType,
        severity: "warning" as Severity,
        config: {
            min_words: 100,
        },
    },
};
