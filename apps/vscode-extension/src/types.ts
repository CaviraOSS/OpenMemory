export type memory_summary = {
    id: string;
    text: string;
    status: 'active' | 'superseded' | 'contradicted' | 'expired' | 'draft';
    world_id: string;
    observed_at: number;
    recorded_at: number;
    confidence: number;
    salience: number;
    activation: number;
    grounded: boolean;
    source: string | null;
    memory_type: string | null;
};

export type memory_list_result = {
    ok: true;
    project_id: string;
    count: number;
    limit: number;
    memories: memory_summary[];
};

export type status_result = {
    ok: true;
    project: { id: string; name: string; initialized: boolean };
    db_path: string;
    memory: { nodes: number; active: number; grounded: number; superseded: number; worlds: number };
    recent_memories: memory_summary[];
    unresolved_conflicts: number;
};

export type harness_id = 'claude-code' | 'codex' | 'opencode' | 'gemini-cli' | 'copilot-chat' | 'cline' | 'deepseek-harness';

export type harness_detection_result = {
    ok: true;
    harnesses: Array<{ harness: harness_id; installed: boolean; can_import: boolean; source_path: string | null; note: string | null }>;
};

export type session_discovery_result = {
    ok: true;
    harness: harness_id;
    count: number;
    projects: Array<{ cwd: string; sessions: Array<{ source_session_id: string; title: string; cwd: string; updated_at?: number; turns: unknown[] }> }>;
};

export type session_port_result = {
    ok: boolean;
    counts: { created: number; updated: number; skipped: number; errors: number };
    outcomes: Array<{ source_session_id: string; status: 'created' | 'updated' | 'skipped' | 'error'; error?: string }>;
};

export type recall_result = {
    ok: true;
    mode: string;
    query: string;
    hits: Array<{ id: string; text: string; status: string; score: number; grounded: boolean; citation: string | null }>;
};

export type project_context_result = {
    ok: true;
    project_id: string;
    task: string;
    project_summary: string;
    current_goal: string;
    hard_constraints: string[];
    relevant_architecture: string[];
    relevant_files: Array<{ path: string; commit?: string; stale?: boolean }>;
    active_decisions: Array<{ decision: string; rationale?: string; current: boolean }>;
    open_tasks: Array<{ task: string; status: string }>;
    known_failures: string[];
    matched_skills?: Array<{
        score: number;
        matched_triggers: string[];
        skill: { skill_id: string; name: string; description: string; version: number; instructions: string[]; validation: string[] };
    }>;
    asset_loadout?: {
        selected: Array<{
            asset: { asset_id: string; type: 'chat_memory' | 'skill' | 'llm_wiki' | 'code_graph'; name: string; version: number; content_ref: string };
            binding: { injection_mode: 'direct' | 'summary' | 'tool' | 'reference'; priority: number } | null;
            annotations: { audience: string[]; priority: number; last_modified: string };
        }>;
        excluded: Array<{ asset_id: string; reason: string }>;
        tokens_used: number;
        token_budget: number;
    } | null;
    conflicts: unknown[];
    suggested_next_steps: string[];
};
