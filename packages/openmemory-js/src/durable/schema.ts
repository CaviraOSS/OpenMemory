export const DURABLE_SCHEMA_VERSION = "2.0.0-durable-core";

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
  "audit_log",
] as const;

export interface DurableSchemaOptions {
  schema?: string;
  vectorDim?: number;
}

const ident = (name: string) => `"${name.replace(/"/g, '""')}"`;
const table = (schema: string, name: string) => `${ident(schema)}.${ident(name)}`;

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
  const auditLog = table(schema, "audit_log");

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
      edge_type text not null,
      weight double precision not null default 1,
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
      status text not null default 'open',
      resolution text,
      confidence double precision not null default 1 check(confidence >= 0 and confidence <= 1),
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      resolved_at timestamptz
    )`,
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
      contracts jsonb not null default '{}'::jsonb,
      confidence double precision not null default 0.5 check(confidence >= 0 and confidence <= 1),
      status text not null default 'pending',
      rejection_reason text,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    )`,
    `create table if not exists ${consolidations} (
      id uuid primary key,
      user_id text not null default 'anonymous',
      project_id text,
      scope jsonb not null default '{}'::jsonb,
      source_memory_ids jsonb not null default '[]'::jsonb,
      result_memory_id uuid references ${memories}(id) on delete set null,
      status text not null default 'pending',
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      completed_at timestamptz
    )`,
    `create table if not exists ${auditLog} (
      id uuid primary key,
      user_id text,
      project_id text,
      event_type text not null,
      target_table text not null,
      target_id uuid,
      operation text not null,
      before_state jsonb,
      after_state jsonb,
      metadata jsonb not null default '{}'::jsonb,
      recorded_at timestamptz not null default now()
    )`,
    `create index if not exists durable_memories_user_idx on ${memories}(user_id)`,
    `create index if not exists durable_memories_project_idx on ${memories}(project_id)`,
    `create index if not exists durable_memories_recorded_idx on ${memories}(recorded_at)`,
    `create index if not exists durable_memories_validity_idx on ${memories}(valid_from, valid_to)`,
    `create index if not exists durable_memories_embedding_idx on ${memories} using hnsw (embedding vector_cosine_ops)`,
    `create index if not exists durable_edges_type_idx on ${edges}(edge_type)`,
    `create index if not exists durable_edges_source_memory_idx on ${edges}(source_memory_id)`,
    `create index if not exists durable_edges_target_memory_idx on ${edges}(target_memory_id)`,
    `create index if not exists durable_contradictions_status_idx on ${contradictions}(status)`,
    `create index if not exists durable_provenance_memory_idx on ${provenance}(memory_id)`,
    `create index if not exists durable_working_memory_user_idx on ${workingMemory}(user_id, project_id)`,
    `create index if not exists durable_working_memory_events_user_idx on ${workingMemoryEvents}(user_id, project_id, status)`,
    `create index if not exists durable_extraction_candidates_event_idx on ${extractionCandidates}(event_id, status)`,
    `create index if not exists durable_audit_target_idx on ${auditLog}(target_table, target_id)`,
    `create index if not exists durable_audit_recorded_idx on ${auditLog}(recorded_at)`,
  ];
}
