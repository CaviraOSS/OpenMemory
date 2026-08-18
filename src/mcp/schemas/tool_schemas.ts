import * as z from 'zod/v4';

const optional_text = z.string().trim().min(1).optional();
const project_id = optional_text.describe('Project scope; omitted to use the server project');
const token_budget = z.number().int().min(64).max(32_768).optional();

export const project_context_schema = {
    project_id,
    cwd: optional_text,
    task: z.string().trim().min(1),
    files: z.array(z.string().trim().min(1)).max(100).optional(),
    mode: z.enum(['coding', 'debugging', 'planning', 'review']),
    token_budget,
};

export const recall_schema = {
    query: z.string().trim().min(1),
    project_id,
    user_id: optional_text,
    mode: z.enum(['strict', 'historical', 'associative', 'world_grounded']),
    token_budget,
};

export const ingest_schema = {
    project_id,
    user_id: optional_text,
    text: z.string().trim().min(1),
    source: z.string().trim().min(1),
    source_ref: optional_text,
    memory_type: optional_text,
};

export const remember_decision_schema = {
    project_id: z.string().trim().min(1),
    decision: z.string().trim().min(1),
    reason: z.string().trim().min(1),
    alternatives_rejected: z.array(z.string().trim().min(1)).max(50).optional(),
    files_affected: z.array(z.string().trim().min(1)).max(100).optional(),
    source_ref: optional_text,
};

export const update_task_state_schema = {
    project_id: z.string().trim().min(1),
    task: z.string().trim().min(1),
    status: z.enum(['open', 'blocked', 'completed', 'stale', 'active', 'resolved']),
    what_changed: optional_text,
    files_touched: z.array(z.string().trim().min(1)).max(100).optional(),
    errors_seen: z.array(z.string().trim().min(1)).max(100).optional(),
    next_steps: z.array(z.string().trim().min(1)).max(100).optional(),
};

export const explain_schema = {
    memory_id: optional_text,
    query_id: optional_text,
};

export const report_conflicts_schema = {
    project_id: z.string().trim().min(1),
    severity: z.enum(['info', 'warning', 'error', 'critical']).optional(),
};

export const sync_connector_schema = {
    connector_id: z.string().trim().min(1),
    project_id,
    dry_run: z.boolean().optional().default(true),
};