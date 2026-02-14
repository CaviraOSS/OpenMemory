/**
 * Template Management (D6)
 *
 * Provides CRUD operations for document templates with typed variables
 * and instantiation to memory entries.
 */

import { run_async, get_async, all_async } from "./db";
import { rid, create_safe_regex, safe_regex_test } from "../utils";

export interface TemplateVariable {
    name: string;
    type: "string" | "number" | "date" | "boolean" | "select" | "list";
    required: boolean;
    default_value?: string | number | boolean;
    description?: string;
    options?: string[];  // For select type
    validation?: string; // Regex pattern for string validation
}

export interface Template {
    id: string;
    name: string;
    description?: string;
    category: string;
    content: string;
    variables: TemplateVariable[];
    tags: string[];
    version: number;
    created_at: number;
    updated_at: number;
    created_by?: string;
}

export interface TemplateInstance {
    template_id: string;
    template_name: string;
    variables: Record<string, any>;
    content: string;
    created_at: number;
}

// Database operations
const is_pg = process.env.OM_METADATA_BACKEND === "postgres";
const sc = process.env.OM_PG_SCHEMA || "public";

/**
 * Create a new template
 */
export async function create_template(
    name: string,
    content: string,
    options: {
        description?: string;
        category?: string;
        variables?: TemplateVariable[];
        tags?: string[];
        created_by?: string;
    } = {}
): Promise<Template> {
    const id = rid();
    const now = Date.now();

    // Auto-detect variables from content if not provided
    const variables = options.variables || extract_variables(content);

    const template: Template = {
        id,
        name,
        description: options.description,
        category: options.category || "general",
        content,
        variables,
        tags: options.tags || [],
        version: 1,
        created_at: now,
        updated_at: now,
        created_by: options.created_by,
    };

    const sql = is_pg
        ? `INSERT INTO "${sc}"."openmemory_templates"(id, name, description, category, content, variables, tags, version, created_at, updated_at, created_by)
           VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`
        : `INSERT INTO templates(id, name, description, category, content, variables, tags, version, created_at, updated_at, created_by)
           VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    await run_async(sql, [
        id,
        name,
        options.description,
        options.category || "general",
        content,
        JSON.stringify(variables),
        JSON.stringify(options.tags || []),
        1,
        now,
        now,
        options.created_by,
    ]);

    return template;
}

/**
 * Get a template by ID
 */
export async function get_template(id: string): Promise<Template | null> {
    const sql = is_pg
        ? `SELECT * FROM "${sc}"."openmemory_templates" WHERE id = $1`
        : `SELECT * FROM templates WHERE id = ?`;

    const row = await get_async(sql, [id]);
    if (!row) return null;

    return {
        ...row,
        variables: typeof row.variables === "string" ? JSON.parse(row.variables) : row.variables,
        tags: typeof row.tags === "string" ? JSON.parse(row.tags) : row.tags,
    };
}

/**
 * List templates with optional filtering
 */
export async function list_templates(options: {
    category?: string;
    search?: string;
    limit?: number;
    offset?: number;
} = {}): Promise<{ templates: Template[]; total: number }> {
    const { category, search, limit = 50, offset = 0 } = options;

    let sql: string;
    let count_sql: string;
    const params: any[] = [];

    if (is_pg) {
        sql = `SELECT * FROM "${sc}"."openmemory_templates"`;
        count_sql = `SELECT COUNT(*) as total FROM "${sc}"."openmemory_templates"`;

        const conditions: string[] = [];
        if (category) {
            conditions.push(`category = $${params.length + 1}`);
            params.push(category);
        }
        if (search) {
            conditions.push(`(name ILIKE $${params.length + 1} OR description ILIKE $${params.length + 1})`);
            params.push(`%${search}%`);
        }

        if (conditions.length > 0) {
            sql += ` WHERE ${conditions.join(" AND ")}`;
            count_sql += ` WHERE ${conditions.join(" AND ")}`;
        }

        sql += ` ORDER BY updated_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);
    } else {
        sql = `SELECT * FROM templates`;
        count_sql = `SELECT COUNT(*) as total FROM templates`;

        const conditions: string[] = [];
        if (category) {
            conditions.push(`category = ?`);
            params.push(category);
        }
        if (search) {
            conditions.push(`(name LIKE ? OR description LIKE ?)`);
            params.push(`%${search}%`, `%${search}%`);
        }

        if (conditions.length > 0) {
            sql += ` WHERE ${conditions.join(" AND ")}`;
            count_sql += ` WHERE ${conditions.join(" AND ")}`;
        }

        sql += ` ORDER BY updated_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);
    }

    const [rows, count_row] = await Promise.all([
        all_async(sql, params),
        get_async(count_sql, params.slice(0, -2)),
    ]);

    return {
        templates: rows.map(row => ({
            ...row,
            variables: typeof row.variables === "string" ? JSON.parse(row.variables) : row.variables,
            tags: typeof row.tags === "string" ? JSON.parse(row.tags) : row.tags,
        })),
        total: count_row?.total || 0,
    };
}

/**
 * Update a template
 */
export async function update_template(
    id: string,
    updates: Partial<Pick<Template, "name" | "description" | "category" | "content" | "variables" | "tags">>
): Promise<Template | null> {
    const existing = await get_template(id);
    if (!existing) return null;

    const now = Date.now();
    const updated = {
        ...existing,
        ...updates,
        variables: updates.content
            ? (updates.variables || extract_variables(updates.content))
            : (updates.variables || existing.variables),
        version: existing.version + 1,
        updated_at: now,
    };

    const sql = is_pg
        ? `UPDATE "${sc}"."openmemory_templates"
           SET name = $1, description = $2, category = $3, content = $4, variables = $5, tags = $6, version = $7, updated_at = $8
           WHERE id = $9`
        : `UPDATE templates
           SET name = ?, description = ?, category = ?, content = ?, variables = ?, tags = ?, version = ?, updated_at = ?
           WHERE id = ?`;

    await run_async(sql, [
        updated.name,
        updated.description,
        updated.category,
        updated.content,
        JSON.stringify(updated.variables),
        JSON.stringify(updated.tags),
        updated.version,
        now,
        id,
    ]);

    return updated;
}

/**
 * Delete a template
 */
export async function delete_template(id: string): Promise<boolean> {
    const sql = is_pg
        ? `DELETE FROM "${sc}"."openmemory_templates" WHERE id = $1`
        : `DELETE FROM templates WHERE id = ?`;

    await run_async(sql, [id]);
    return true;
}

/**
 * Extract variables from template content
 * Supports {{variable_name}} and {{variable_name:type}} syntax
 */
export function extract_variables(content: string): TemplateVariable[] {
    const pattern = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)(?::([a-z]+))?(?:\|([^}]+))?\}\}/g;
    const variables: Map<string, TemplateVariable> = new Map();

    let match;
    while ((match = pattern.exec(content)) !== null) {
        const name = match[1];
        const type_hint = match[2] as TemplateVariable["type"] || "string";
        const default_value = match[3];

        if (!variables.has(name)) {
            variables.set(name, {
                name,
                type: type_hint,
                required: default_value === undefined,
                default_value: default_value,
            });
        }
    }

    return Array.from(variables.values());
}

/**
 * Validate variables against template schema
 */
export function validate_variables(
    template: Template,
    values: Record<string, any>
): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const variable of template.variables) {
        const value = values[variable.name];

        // Check required
        if (variable.required && (value === undefined || value === null || value === "")) {
            errors.push(`Variable '${variable.name}' is required`);
            continue;
        }

        // Skip validation if not provided and not required
        if (value === undefined || value === null) continue;

        // Type validation
        switch (variable.type) {
            case "number":
                if (typeof value !== "number" && isNaN(Number(value))) {
                    errors.push(`Variable '${variable.name}' must be a number`);
                }
                break;

            case "date":
                if (isNaN(Date.parse(value))) {
                    errors.push(`Variable '${variable.name}' must be a valid date`);
                }
                break;

            case "boolean":
                if (typeof value !== "boolean" && !["true", "false", "1", "0"].includes(String(value))) {
                    errors.push(`Variable '${variable.name}' must be a boolean`);
                }
                break;

            case "select":
                if (variable.options && !variable.options.includes(String(value))) {
                    errors.push(`Variable '${variable.name}' must be one of: ${variable.options.join(", ")}`);
                }
                break;

            case "list":
                if (!Array.isArray(value)) {
                    errors.push(`Variable '${variable.name}' must be an array`);
                }
                break;

            case "string":
                if (variable.validation) {
                    const regex = create_safe_regex(variable.validation);
                    if (!regex) {
                        errors.push(`Variable '${variable.name}' has invalid or unsafe validation pattern`);
                    } else if (!safe_regex_test(regex, String(value))) {
                        errors.push(`Variable '${variable.name}' does not match required pattern`);
                    }
                }
                break;
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Instantiate a template with variable values
 */
export function instantiate_template(
    template: Template,
    values: Record<string, any>
): TemplateInstance {
    let content = template.content;

    // Replace variables with values
    for (const variable of template.variables) {
        const value = values[variable.name] ?? variable.default_value ?? "";
        const pattern = new RegExp(
            `\\{\\{${variable.name}(?::[a-z]+)?(?:\\|[^}]+)?\\}\\}`,
            "g"
        );

        // Format value based on type
        let formatted_value: string;
        switch (variable.type) {
            case "date":
                // Format as ISO date
                formatted_value = value ? new Date(value).toISOString().split("T")[0] : "";
                break;

            case "list":
                formatted_value = Array.isArray(value) ? value.join(", ") : String(value);
                break;

            case "boolean":
                formatted_value = value ? "Yes" : "No";
                break;

            default:
                formatted_value = String(value);
        }

        content = content.replace(pattern, formatted_value);
    }

    return {
        template_id: template.id,
        template_name: template.name,
        variables: values,
        content,
        created_at: Date.now(),
    };
}

/**
 * Get template categories
 */
export async function get_template_categories(): Promise<string[]> {
    const sql = is_pg
        ? `SELECT DISTINCT category FROM "${sc}"."openmemory_templates" ORDER BY category`
        : `SELECT DISTINCT category FROM templates ORDER BY category`;

    const rows = await all_async(sql, []);
    return rows.map(r => r.category);
}

/**
 * Clone a template
 */
export async function clone_template(
    id: string,
    new_name: string,
    created_by?: string
): Promise<Template | null> {
    const original = await get_template(id);
    if (!original) return null;

    return create_template(new_name, original.content, {
        description: `Clone of ${original.name}`,
        category: original.category,
        variables: original.variables,
        tags: original.tags,
        created_by,
    });
}
