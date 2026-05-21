export const DURABLE_SCHEMA_VERSION = "2.0.0-durable-core";

export const DURABLE_EDGE_TYPES = [
  "mentions",
  "supports",
  "contradicts",
  "derives_from",
  "supersedes",
  "same_as",
  "causes",
  "depends_on",
  "part_of",
  "related_to",
] as const;

export const DURABLE_TABLES = [
  "memories",
  "memory_versions",
  "entities",
  "memory_entities",
  "edges",
  "contradictions",
  "provenance",
  "inferences",
  "working_memory",
  "working_memory_events",
  "extraction_candidates",
  "consolidations",
  "consolidation_results",
  "audit_log",
] as const;

export interface DurableSchemaOptions {
  schema?: string;
  vectorDim?: number;
}

const ident = (name: string) => `"${name.replace(/"/g, '""')}"`;
const table = (schema: string, name: string) =>
  `${ident(schema)}.${ident(name)}`;

export function buildDurableSchemaSql(options: DurableSchemaOptions = {}) {
  const schema = options.schema || "public";
  const vectorDim = options.vectorDim || 1536;

  const memories = table(schema, "memories");
  const memoryVersions = table(schema, "memory_versions");
  const entities = table(schema, "entities");
  const memoryEntities = table(schema, "memory_entities");
  const edges = table(schema, "edges");
  const contradictions = table(schema, "contradictions");
  const provenance = table(schema, "provenance");
  const inferences = table(schema, "inferences");
  const workingMemory = table(schema, "working_memory");
  const workingMemoryEvents = table(schema, "working_memory_events");
  const extractionCandidates = table(schema, "extraction_candidates");
  const consolidations = table(schema, "consolidations");
  const consolidationResults = table(schema, "consolidation_results");
  const auditLog = table(schema, "audit_log");
  const edgeTypeCheck = DURABLE_EDGE_TYPES.map((type) => `'${type}'`).join(",");

  return [
    `create schema if not exists ${ident(schema)}`,
    `create extension if not exists vector`,
    `create table if not exists ${memories} (
      id uuid primary key,
      user_id text not null default 'anonymous',
      project_id text,
      content text not null,
      facets jsonb not null default '{}'::jsonb,
      contracts jsonb not null default '{}'::jsonb,
      metadata jsonb not null default '{}'::jsonb,
      embedding vector(${vectorDim}),
      confidence double precision not null default 1 check(confidence >= 0 and confidence <= 1),
      salience double precision not null default 0.5 check(salience >= 0 and salience <= 1),
      memory_tier text not null default 'active',
      valid_from timestamptz,
      valid_to timestamptz,
      observed_at timestamptz,
      recorded_at timestamptz not null default now(),
      superseded_at timestamptz
    )`,
    `create table if not exists ${memoryVersions} (
      id uuid primary key,
      memory_id uuid not null references ${memories}(id) on delete cascade,
      version integer not null,
      content text not null,
      facets jsonb not null default '{}'::jsonb,
      contracts jsonb not null default '{}'::jsonb,
      metadata jsonb not null default '{}'::jsonb,
      recorded_at timestamptz not null default now(),
      unique(memory_id, version)
    )`,
    `create table if not exists ${entities} (
      id uuid primary key,
      user_id text not null default 'anonymous',
      project_id text,
      entity_type text not null,
      canonical_name text not null,
      aliases jsonb not null default '[]'::jsonb,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )`,
    `create table if not exists ${memoryEntities} (
      memory_id uuid not null references ${memories}(id) on delete cascade,
      entity_id uuid not null references ${entities}(id) on delete cascade,
      role text,
      confidence double precision not null default 1 check(confidence >= 0 and confidence <= 1),
      primary key(memory_id, entity_id)
    )`,
    `create table if not exists ${edges} (
      id uuid primary key,
      user_id text not null default 'anonymous',
      project_id text,
      source_memory_id uuid references ${memories}(id) on delete cascade,
      target_memory_id uuid references ${memories}(id) on delete cascade,
      source_entity_id uuid references ${entities}(id) on delete cascade,
      target_entity_id uuid references ${entities}(id) on delete cascade,
      edge_type text not null check(edge_type in (${edgeTypeCheck})),
      weight double precision not null default 1,
      confidence double precision not null default 1 check(confidence >= 0 and confidence <= 1),
      provenance jsonb not null default '{}'::jsonb,
      metadata jsonb not null default '{}'::jsonb,
      valid_from timestamptz,
      valid_to timestamptz,
      recorded_at timestamptz not null default now()
    )`,
    `create table if not exists ${contradictions} (
      id uuid primary key,
      user_id text not null default 'anonymous',
      project_id text,
      memory_id uuid not null references ${memories}(id) on delete cascade,
      contradicts_memory_id uuid not null references ${memories}(id) on delete cascade,
      conflict_group_id text,
      resolution_policy text not null default 'manual',
      status text not null default 'open',
      resolution text,
      resolved_by text,
      resolution_reason text,
      confidence double precision not null default 1 check(confidence >= 0 and confidence <= 1),
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      resolved_at timestamptz
    )`,
    `alter table ${contradictions} add column if not exists conflict_group_id text`,
    `alter table ${contradictions} add column if not exists resolution_policy text not null default 'manual'`,
    `alter table ${contradictions} add column if not exists resolved_by text`,
    `alter table ${contradictions} add column if not exists resolution_reason text`,
    `create table if not exists ${provenance} (
      id uuid primary key,
      memory_id uuid not null references ${memories}(id) on delete cascade,
      source_kind text not null,
      source_uri text,
      source_id text,
      extraction_method text,
      trust_score double precision not null default 0.5 check(trust_score >= 0 and trust_score <= 1),
      observed_at timestamptz,
      metadata jsonb not null default '{}'::jsonb,
      recorded_at timestamptz not null default now()
    )`,
    `create table if not exists ${inferences} (
      id uuid primary key,
      memory_id uuid not null references ${memories}(id) on delete cascade,
      derived_from jsonb not null default '[]'::jsonb,
      inference_method text not null,
      confidence double precision not null default 0.5 check(confidence >= 0 and confidence <= 1),
      metadata jsonb not null default '{}'::jsonb,
      recorded_at timestamptz not null default now()
    )`,
    `create table if not exists ${workingMemory} (
      id uuid primary key,
      user_id text not null default 'anonymous',
      project_id text,
      memory_id uuid references ${memories}(id) on delete cascade,
      content text not null,
      expires_at timestamptz,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    )`,
    `create table if not exists ${workingMemoryEvents} (
      id uuid primary key,
      user_id text not null default 'anonymous',
      project_id text,
      source jsonb not null default '{}'::jsonb,
      content text not null,
      metadata jsonb not null default '{}'::jsonb,
      contracts jsonb not null default '{}'::jsonb,
      status text not null default 'pending',
      observed_at timestamptz,
      recorded_at timestamptz not null default now(),
      processed_at timestamptz,
      error text
    )`,
    `create table if not exists ${extractionCandidates} (
      id uuid primary key,
      event_id uuid not null references ${workingMemoryEvents}(id) on delete cascade,
      user_id text not null default 'anonymous',
      project_id text,
      content text not null,
      facets jsonb not null default '{}'::jsonb,
      entities jsonb not null default '[]'::jsonb,
      edges jsonb not null default '[]'::jsonb,
      contradictions jsonb not null default '[]'::jsonb,
      contracts jsonb not null default '{}'::jsonb,
      confidence double precision not null default 0.5 check(confidence >= 0 and confidence <= 1),
      status text not null default 'pending',
      rejection_reason text,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    )`,
    `alter table ${extractionCandidates} add column if not exists contradictions jsonb not null default '[]'::jsonb`,
    `create table if not exists ${consolidations} (
      id uuid primary key,
      user_id text not null default 'anonymous',
      project_id text,
      idempotency_key text,
      scope jsonb not null default '{}'::jsonb,
      source_memory_ids jsonb not null default '[]'::jsonb,
      result_memory_id uuid references ${memories}(id) on delete set null,
      status text not null default 'pending',
      worker_id text,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      started_at timestamptz,
      completed_at timestamptz
    )`,
    `alter table ${consolidations} add column if not exists idempotency_key text`,
    `alter table ${consolidations} add column if not exists worker_id text`,
    `alter table ${consolidations} add column if not exists started_at timestamptz`,
    `create table if not exists ${consolidationResults} (
      id uuid primary key,
      consolidation_id uuid not null references ${consolidations}(id) on delete cascade,
      result_memory_id uuid references ${memories}(id) on delete set null,
      source_memory_ids jsonb not null default '[]'::jsonb,
      summary text,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    )`,
    `create index if not exists durable_consolidation_results_request_idx on ${consolidationResults}(consolidation_id)`,
    `create table if not exists ${auditLog} (
      id uuid primary key,
      user_id text,
      project_id text,
      actor_id text not null default 'system',
      actor_type text not null default 'system',
      event_type text not null,
      target_table text not null,
      target_id uuid,
      operation text not null,
      before_state jsonb,
      after_state jsonb,
      metadata jsonb not null default '{}'::jsonb,
      recorded_at timestamptz not null default now()
    )`,
    `alter table ${auditLog} add column if not exists actor_id text not null default 'system'`,
    `alter table ${auditLog} add column if not exists actor_type text not null default 'system'`,
    `create index if not exists durable_memories_user_idx on ${memories}(user_id)`,
    `create index if not exists durable_memories_project_idx on ${memories}(project_id)`,
    `create index if not exists durable_memories_recorded_idx on ${memories}(recorded_at)`,
    `create index if not exists durable_memories_validity_idx on ${memories}(valid_from, valid_to)`,
    `create index if not exists durable_memories_tenant_project_current_idx on ${memories}(user_id, project_id, recorded_at desc) where superseded_at is null`,
    `create index if not exists durable_memories_global_current_idx on ${memories}(user_id, recorded_at desc) where project_id is null and superseded_at is null`,
    `drop index if exists ${ident(schema)}.durable_memories_embedding_idx`,
    `create index if not exists durable_memories_embedding_idx on ${memories} using hnsw (embedding vector_cosine_ops) where embedding is not null`,
    `create index if not exists durable_edges_type_idx on ${edges}(edge_type)`,
    `create index if not exists durable_edges_source_memory_idx on ${edges}(source_memory_id)`,
    `create index if not exists durable_edges_target_memory_idx on ${edges}(target_memory_id)`,
    `create index if not exists durable_edges_tenant_source_idx on ${edges}(user_id, project_id, source_memory_id)`,
    `create index if not exists durable_contradictions_status_idx on ${contradictions}(status)`,
    `create index if not exists durable_contradictions_group_idx on ${contradictions}(conflict_group_id, status)`,
    `create index if not exists durable_contradictions_memory_status_project_idx on ${contradictions}(memory_id, status, project_id)`,
    `create index if not exists durable_provenance_memory_idx on ${provenance}(memory_id)`,
    `create index if not exists durable_provenance_source_idx on ${provenance}(source_kind, source_id, source_uri)`,
    `create index if not exists durable_provenance_memory_source_idx on ${provenance}(memory_id, source_kind, source_id, source_uri)`,
    `create unique index if not exists durable_consolidations_idempotency_idx on ${consolidations}(user_id, project_id, idempotency_key) where idempotency_key is not null`,
    `create index if not exists durable_working_memory_user_idx on ${workingMemory}(user_id, project_id)`,
    `create index if not exists durable_working_memory_events_user_idx on ${workingMemoryEvents}(user_id, project_id, status)`,
    `create index if not exists durable_extraction_candidates_event_idx on ${extractionCandidates}(event_id, status)`,
    `create index if not exists durable_audit_target_idx on ${auditLog}(target_table, target_id)`,
    `create index if not exists durable_audit_recorded_idx on ${auditLog}(recorded_at)`,
  ];
}
