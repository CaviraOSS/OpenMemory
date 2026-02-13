/**
 * Template Management API Routes (D6)
 *
 * Provides CRUD operations for document templates.
 */

import {
    create_template,
    get_template,
    list_templates,
    update_template,
    delete_template,
    validate_variables,
    instantiate_template,
    extract_variables,
    get_template_categories,
    clone_template,
} from "../../core/templates";
import { add_memory } from "../../memory/hsg";
import { audit_log } from "../../core/audit";

export function templates(app: any) {
    /**
     * GET /templates
     *
     * List templates with optional filtering.
     */
    app.get("/templates", async (req: any, res: any) => {
        try {
            const { category, search, limit, offset } = req.query;

            const result = await list_templates({
                category,
                search,
                limit: limit ? parseInt(limit, 10) : undefined,
                offset: offset ? parseInt(offset, 10) : undefined,
            });

            res.json({
                templates: result.templates.map(t => ({
                    id: t.id,
                    name: t.name,
                    description: t.description,
                    category: t.category,
                    tags: t.tags,
                    variable_count: t.variables.length,
                    version: t.version,
                    updated_at: t.updated_at,
                })),
                total: result.total,
            });
        } catch (e: any) {
            console.error("[templates] list failed:", e);
            res.status(500).json({ err: "template_list_failed" });
        }
    });

    /**
     * GET /templates/categories
     *
     * Get list of template categories.
     */
    app.get("/templates/categories", async (_req: any, res: any) => {
        try {
            const categories = await get_template_categories();
            res.json({ categories });
        } catch (e: any) {
            console.error("[templates] categories failed:", e);
            res.status(500).json({ err: "categories_failed" });
        }
    });

    /**
     * GET /templates/:id
     *
     * Get a specific template with full content and variables.
     */
    app.get("/templates/:id", async (req: any, res: any) => {
        try {
            const { id } = req.params;
            const template = await get_template(id);

            if (!template) {
                return res.status(404).json({ err: "template_not_found" });
            }

            res.json(template);
        } catch (e: any) {
            console.error("[templates] get failed:", e);
            res.status(500).json({ err: "template_get_failed" });
        }
    });

    /**
     * POST /templates
     *
     * Create a new template.
     */
    app.post("/templates", async (req: any, res: any) => {
        try {
            const {
                name,
                content,
                description,
                category,
                variables,
                tags,
                user_id,
            } = req.body || {};

            if (!name || !content) {
                return res.status(400).json({ err: "missing_name_or_content" });
            }

            const template = await create_template(name, content, {
                description,
                category,
                variables,
                tags,
                created_by: user_id,
            });

            res.json({
                ok: true,
                template: {
                    id: template.id,
                    name: template.name,
                    category: template.category,
                    variable_count: template.variables.length,
                    variables: template.variables,
                },
            });

            // Audit log
            audit_log("template", template.id, "create", {
                actor_id: user_id,
                metadata: { name, category: template.category },
            }).catch(e => console.error("[audit] log failed:", e));
        } catch (e: any) {
            console.error("[templates] create failed:", e);
            res.status(500).json({ err: "template_create_failed" });
        }
    });

    /**
     * PUT /templates/:id
     *
     * Update an existing template.
     */
    app.put("/templates/:id", async (req: any, res: any) => {
        try {
            const { id } = req.params;
            const { name, content, description, category, variables, tags, user_id } = req.body || {};

            const template = await update_template(id, {
                name,
                content,
                description,
                category,
                variables,
                tags,
            });

            if (!template) {
                return res.status(404).json({ err: "template_not_found" });
            }

            res.json({
                ok: true,
                template: {
                    id: template.id,
                    name: template.name,
                    version: template.version,
                    variable_count: template.variables.length,
                },
            });

            // Audit log
            audit_log("template", id, "update", {
                actor_id: user_id,
                changes: { name, category },
            }).catch(e => console.error("[audit] log failed:", e));
        } catch (e: any) {
            console.error("[templates] update failed:", e);
            res.status(500).json({ err: "template_update_failed" });
        }
    });

    /**
     * DELETE /templates/:id
     *
     * Delete a template.
     */
    app.delete("/templates/:id", async (req: any, res: any) => {
        try {
            const { id } = req.params;
            const { user_id } = req.body || {};

            const template = await get_template(id);
            if (!template) {
                return res.status(404).json({ err: "template_not_found" });
            }

            await delete_template(id);

            res.json({
                ok: true,
                deleted: id,
            });

            // Audit log
            audit_log("template", id, "delete", {
                actor_id: user_id,
                metadata: { name: template.name },
            }).catch(e => console.error("[audit] log failed:", e));
        } catch (e: any) {
            console.error("[templates] delete failed:", e);
            res.status(500).json({ err: "template_delete_failed" });
        }
    });

    /**
     * POST /templates/:id/clone
     *
     * Clone a template.
     */
    app.post("/templates/:id/clone", async (req: any, res: any) => {
        try {
            const { id } = req.params;
            const { name, user_id } = req.body || {};

            if (!name) {
                return res.status(400).json({ err: "missing_name" });
            }

            const template = await clone_template(id, name, user_id);

            if (!template) {
                return res.status(404).json({ err: "template_not_found" });
            }

            res.json({
                ok: true,
                template: {
                    id: template.id,
                    name: template.name,
                    category: template.category,
                },
            });
        } catch (e: any) {
            console.error("[templates] clone failed:", e);
            res.status(500).json({ err: "template_clone_failed" });
        }
    });

    /**
     * POST /templates/:id/validate
     *
     * Validate variables against a template's schema.
     */
    app.post("/templates/:id/validate", async (req: any, res: any) => {
        try {
            const { id } = req.params;
            const { variables } = req.body || {};

            const template = await get_template(id);
            if (!template) {
                return res.status(404).json({ err: "template_not_found" });
            }

            const result = validate_variables(template, variables || {});

            res.json({
                valid: result.valid,
                errors: result.errors,
                required_variables: template.variables.filter(v => v.required).map(v => v.name),
            });
        } catch (e: any) {
            console.error("[templates] validate failed:", e);
            res.status(500).json({ err: "template_validate_failed" });
        }
    });

    /**
     * POST /templates/:id/preview
     *
     * Preview template instantiation without saving.
     */
    app.post("/templates/:id/preview", async (req: any, res: any) => {
        try {
            const { id } = req.params;
            const { variables } = req.body || {};

            const template = await get_template(id);
            if (!template) {
                return res.status(404).json({ err: "template_not_found" });
            }

            // Validate first
            const validation = validate_variables(template, variables || {});
            if (!validation.valid) {
                return res.status(400).json({
                    err: "validation_failed",
                    errors: validation.errors,
                });
            }

            const instance = instantiate_template(template, variables || {});

            res.json({
                template_id: template.id,
                template_name: template.name,
                content: instance.content,
                variables_used: variables,
            });
        } catch (e: any) {
            console.error("[templates] preview failed:", e);
            res.status(500).json({ err: "template_preview_failed" });
        }
    });

    /**
     * POST /templates/:id/instantiate
     *
     * Instantiate a template and create a memory entry.
     */
    app.post("/templates/:id/instantiate", async (req: any, res: any) => {
        try {
            const { id } = req.params;
            const { variables, user_id, tags: extra_tags, metadata: extra_meta } = req.body || {};

            const template = await get_template(id);
            if (!template) {
                return res.status(404).json({ err: "template_not_found" });
            }

            // Validate
            const validation = validate_variables(template, variables || {});
            if (!validation.valid) {
                return res.status(400).json({
                    err: "validation_failed",
                    errors: validation.errors,
                });
            }

            // Instantiate
            const instance = instantiate_template(template, variables || {});

            // Create memory entry
            const memory = await add_memory(instance.content, {
                tags: [...template.tags, ...(extra_tags || [])],
                metadata: {
                    template_id: template.id,
                    template_name: template.name,
                    template_version: template.version,
                    instantiated_at: instance.created_at,
                    variables_used: variables,
                    ...(extra_meta || {}),
                },
                user_id,
            });

            res.json({
                ok: true,
                memory_id: memory.id,
                template_id: template.id,
                content_preview: instance.content.substring(0, 200) + (instance.content.length > 200 ? "..." : ""),
            });

            // Audit log
            audit_log("template", id, "ingest", {
                actor_id: user_id,
                metadata: {
                    action: "instantiate",
                    memory_id: memory.id,
                    variables: Object.keys(variables || {}),
                },
            }).catch(e => console.error("[audit] log failed:", e));
        } catch (e: any) {
            console.error("[templates] instantiate failed:", e);
            res.status(500).json({ err: "template_instantiate_failed" });
        }
    });

    /**
     * POST /templates/extract-variables
     *
     * Extract variables from template content without saving.
     */
    app.post("/templates/extract-variables", async (req: any, res: any) => {
        try {
            const { content } = req.body || {};

            if (!content) {
                return res.status(400).json({ err: "missing_content" });
            }

            const variables = extract_variables(content);

            res.json({
                count: variables.length,
                variables,
            });
        } catch (e: any) {
            console.error("[templates] extract variables failed:", e);
            res.status(500).json({ err: "extract_variables_failed" });
        }
    });
}
