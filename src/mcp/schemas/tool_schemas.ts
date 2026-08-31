/*
*      __                      __  ___
*     / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
*    / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
*   / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
*  /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : src/mcp/schemas/tool_schemas.ts
 *  usage : implements the LongMemory tool schemas component
 */


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
    agent_id: optional_text,
    framework: optional_text,
    task_id: optional_text,
};

export const match_skills_schema = {
    project_id,
    query: z.string().trim().min(1),
    agent_id: optional_text,
    limit: z.number().int().min(1).max(100).optional(),
};

export const manage_skill_schema = {
    action: z.enum(['create', 'bind', 'archive']),
    project_id: z.string().trim().min(1),
    skill_id: optional_text,
    name: optional_text,
    description: optional_text,
    triggers: z.array(z.string().trim().min(1)).max(100).optional(),
    instructions: z.array(z.string().trim().min(1)).max(200).optional(),
    validation: z.array(z.string().trim().min(1)).max(100).optional(),
    resources: z.array(z.object({ path: z.string().trim().min(1), description: optional_text, checksum: optional_text })).max(100).optional(),
    agent_ids: z.array(z.string().trim().min(1)).max(100).optional(),
    visibility: z.enum(['private', 'project', 'team', 'restricted']).optional(),
    owner: optional_text,
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

export const code_graph_schema = {
    action: z.enum(['search', 'callers', 'callees', 'impact']),
    project_id,
    query: optional_text,
    symbol: optional_text,
    limit: z.number().int().min(1).max(200).optional(),
    max_depth: z.number().int().min(1).max(20).optional(),
};

const asset_acl = z.object({
    subject_type: z.enum(['user', 'team', 'role', 'agent', 'task', 'framework']),
    subject_id: z.string().trim().min(1),
    permissions: z.array(z.enum(['read', 'use', 'assign', 'share', 'manage'])).min(1).max(5),
    effect: z.enum(['allow', 'deny']),
});

const asset_binding = z.object({
    target_type: z.enum(['agent', 'task', 'framework']), target_id: z.string().trim().min(1),
    injection_mode: z.enum(['direct', 'summary', 'tool', 'reference']), priority: z.number().min(0).max(1),
    required: z.boolean().optional(), enabled: z.boolean().optional(), created_by: optional_text,
});

export const asset_catalog_schema = {
    action: z.enum(['list', 'get', 'loadout']), project_id, asset_id: optional_text, query: optional_text,
    agent_id: optional_text, task_id: optional_text, framework: optional_text, include_unbound: z.boolean().optional(),
    asset_types: z.array(z.enum(['chat_memory', 'skill', 'llm_wiki', 'code_graph'])).max(4).optional(), token_budget,
};

export const manage_asset_schema = {
    action: z.enum(['register', 'govern']), project_id, asset_id: optional_text,
    type: z.enum(['chat_memory', 'skill', 'llm_wiki', 'code_graph']).optional(), name: optional_text, description: optional_text,
    source_type: optional_text, source_ref: optional_text, content_ref: optional_text,
    status: z.enum(['draft', 'candidate', 'approved', 'deprecated', 'archived', 'failed']).optional(),
    visibility: z.enum(['private', 'project', 'team', 'restricted', 'agent', 'task']).optional(),
    team_ids: z.array(z.string().trim().min(1)).max(100).optional(), acl: z.array(asset_acl).max(200).optional(),
    bindings: z.array(asset_binding).max(200).optional(), confidence: z.number().min(0).max(1).optional(),
    expires_at: z.number().finite().optional(), labels: z.array(z.string().trim().min(1)).max(100).optional(),
    payload: z.record(z.string(), z.unknown()).optional(), metadata: z.record(z.string(), z.unknown()).optional(),
};

