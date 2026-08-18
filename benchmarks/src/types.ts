export type provider_name = "openmemory" | "supermemory" | "mem0" | "graphiti" | "cognee";
export type dataset_name = "smoke" | "longmemeval" | "locomo";
export type provider_status = "completed" | "partial" | "unavailable" | "failed";
export type phase_status = "pending" | "running" | "completed" | "failed";
export type model_provider = "openai" | "anthropic" | "google" | "openai-compatible" | "ollama" | "codex" | "claude-code";

export type benchmark_event = {
    id: string;
    text: string;
    timestamp: number;
    metadata: Record<string, unknown>;
};

export type benchmark_case = {
    id: string;
    corpus_id: string;
    dataset: dataset_name;
    category: string;
    question: string;
    answer: string;
    user_id: string;
    events: benchmark_event[];
    evidence_ids: string[];
    forbidden_ids: string[];
    question_date?: string;
};

export type dataset_load = {
    name: dataset_name;
    official: boolean;
    source: string;
    path: string | null;
    cases: benchmark_case[];
};

export type benchmark_scope = {
    run_id: string;
    case_id: string;
    corpus_id: string;
    user_id: string;
    question_time?: number;
};

export type ingest_result = {
    ids: string[];
    pending_ids?: string[];
};

export type indexing_progress = {
    completed: number;
    failed: number;
    total: number;
};

export type search_hit = {
    id?: string;
    text: string;
    score?: number;
    metadata: Record<string, unknown>;
};

export type route_config = {
    health: string;
    reset: string;
    ingest: string;
    search: string;
    indexing?: string;
};

export type provider_config = {
    base_url: string;
    api_key?: string;
    timeout_ms?: number;
    profile?: string;
    embedding_batch_size?: number;
    headers?: Record<string, string>;
    routes?: Partial<route_config>;
};

export interface benchmark_provider {
    readonly name: provider_name;
    readonly display_name: string;
    initialize(config: provider_config): Promise<void>;
    health(): Promise<void>;
    reset(scope: benchmark_scope): Promise<void>;
    ingest(events: benchmark_event[], scope: benchmark_scope): Promise<ingest_result>;
    await_indexing(result: ingest_result, scope: benchmark_scope, progress?: (value: indexing_progress) => void): Promise<void>;
    search(query: string, limit: number, scope: benchmark_scope): Promise<search_hit[]>;
    close(): Promise<void>;
}

export type model_config = {
    provider: model_provider;
    model: string;
    api_key: string;
    base_url?: string;
    timeout_ms: number;
    max_retries: number;
    max_tokens: number;
    temperature: number;
    command?: string;
};

export type model_request = {
    system?: string;
    user: string;
    json?: boolean;
    max_tokens?: number;
    temperature?: number;
};

export type model_response = {
    text: string;
    prompt_tokens: number | null;
    completion_tokens: number | null;
};

export interface language_model {
    readonly provider: model_provider;
    readonly model: string;
    generate(request: model_request): Promise<model_response>;
}

export type judge_input = {
    question: string;
    category: string;
    ground_truth: string;
    hypothesis: string;
    evidence: string[];
};

export type judge_result = {
    score: number;
    label: "correct" | "incorrect";
    explanation: string;
    raw: string;
};

export interface ai_judge {
    readonly name: string;
    readonly model: string;
    evaluate(input: judge_input): Promise<judge_result>;
}

export type matched_hit = search_hit & {
    evidence_id: string | null;
    match_method: "source_ref" | "source_id" | "lexical" | "none";
};

export type retrieval_metrics = {
    k: number;
    queries: number;
    hit_rate: number;
    precision: number;
    recall: number;
    f1: number;
    mrr: number;
    ndcg: number;
};

export type latency_stats = {
    count: number;
    min: number;
    max: number;
    mean: number;
    p50: number;
    p95: number;
    p99: number;
    stddev: number;
};

export type phase_record = {
    status: phase_status;
    started_at?: string;
    completed_at?: string;
    duration_ms?: number;
    error?: string;
};

export type case_checkpoint = {
    case_id: string;
    corpus_id: string;
    dataset: dataset_name;
    category: string;
    ingest_reused?: boolean;
    phases: {
        ingest: phase_record;
        indexing: phase_record;
        search: phase_record;
        evaluate: phase_record;
        answer: phase_record;
        judge: phase_record;
    };
    hits?: matched_hit[];
    metrics?: retrieval_metrics[];
    stale_leakage?: boolean;
    abstention_correct?: boolean | null;
    context_tokens?: number;
    cutoff_results?: Record<string, cutoff_judgment>;
};

export type cutoff_judgment = {
    k: number;
    memories_evaluated: number;
    hypothesis: string;
    score?: number;
    label?: "correct" | "incorrect";
    explanation?: string;
    prompt_tokens: number;
    base_prompt_tokens: number;
    context_tokens: number;
    completion_tokens: number | null;
    answer_duration_ms: number;
    judge_duration_ms?: number;
    judge_raw?: string;
    error?: string;
};

export type provider_manifest = {
    name: provider_name;
    base_url: string;
    timeout_ms: number | null;
    profile: string | null;
    routes: Partial<route_config>;
    authenticated: boolean;
    header_names: string[];
};

export type run_manifest = {
    version: 1;
    official: boolean;
    evaluation_mode: "official" | "retrieval-diagnostic" | "smoke-diagnostic";
    environment: {
        node_version: string;
        platform: NodeJS.Platform;
        os_release: string;
        architecture: string;
        cpu_model: string;
        logical_cpus: number;
        total_memory_mb: number;
    };
    providers: provider_manifest[];
    datasets: dataset_name[];
    case_ids: string[];
    case_datasets: Record<string, dataset_name>;
    cutoffs: number[];
    per_category: number;
    sample_offset: number;
    matching: { version: 2; lexical_threshold: number; opaque_source_ref_first: true; source_id_first: false };
    context_token_budget: number;
    openmemory_embedding: {
        provider: string;
        model: string;
        tier: string;
        dimension: number;
        fallback: string[];
        batch_size: number;
        inputs_per_minute: number;
    } | null;
    ai: {
        enabled: boolean;
        answerer: ai_model_manifest | null;
        judge: ai_model_manifest | null;
        per_cutoff: true;
    };
};

export type ai_model_manifest = {
    provider: model_provider;
    model: string;
    base_url: string | null;
    timeout_ms: number;
    max_retries: number;
    max_tokens: number;
    temperature: number;
    command: string | null;
};

export type run_checkpoint = {
    schema_version: 1;
    run_id: string;
    created_at: string;
    updated_at: string;
    manifest: run_manifest;
    providers: Partial<Record<provider_name, Record<string, case_checkpoint>>>;
};

export type category_report = {
    category: string;
    questions: number;
    metrics: retrieval_metrics[];
    abstention_accuracy: number | null;
    stale_leakage_rate: number;
    answer_accuracy: Record<string, number>;
};

export type dataset_report = {
    dataset: dataset_name;
    questions: number;
    failed_questions: number;
    metrics: retrieval_metrics[];
    answer_accuracy: Record<string, number>;
};

export type provider_report = {
    name: provider_name;
    display_name: string;
    status: provider_status;
    reason?: string;
    questions: number;
    failed_questions: number;
    metrics: retrieval_metrics[];
    datasets: dataset_report[];
    categories: category_report[];
    latency: {
        ingest: latency_stats;
        indexing: latency_stats;
        search: latency_stats;
        answer: latency_stats;
        judge: latency_stats;
        total: latency_stats;
    };
    average_context_tokens: number;
    stale_leakage_rate: number;
    abstention_accuracy: number | null;
    memscore: string | null;
    answer_accuracy: Record<string, number>;
    ai_cutoffs: Record<string, ai_cutoff_report>;
    cases: case_checkpoint[];
};

export type ai_cutoff_report = {
    k: number;
    questions: number;
    accuracy: number;
    answer_latency: latency_stats;
    judge_latency: latency_stats;
    tokens: {
        prompt: number;
        base_prompt: number;
        context: number;
        completion: number;
    };
};

export type gate_check = {
    provider: provider_name;
    name: string;
    value: number;
    comparator: "gte" | "lte";
    target: number;
    passed: boolean;
};

export type benchmark_report = {
    schema_version: 1;
    run_id: string;
    generated_at: string;
    manifest: run_manifest;
    providers: provider_report[];
    gates: { passed: boolean; checks: gate_check[] };
};
