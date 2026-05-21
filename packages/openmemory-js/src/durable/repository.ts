import crypto from "node:crypto";
import { scoreDurableRecall } from "./scoring";
import { enrichDurableMetadata } from "./metadata";
import { computeLexicalScore } from "../utilities/keyword";

export const ALLOWED_DURABLE_EDGE_TYPES = [
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

export type DurableEdgeType = (typeof ALLOWED_DURABLE_EDGE_TYPES)[number];
export type DurableMemoryTier = "active" | "warm" | "cold" | "archived";

export const PUBLIC_DURABLE_CONTRACT_FIELDS = [
  "recall_allowed",
  "retention_policy",
  "sensitivity",
  "source_visibility",
  "expires_at",
] as const;

export type DurableRetentionPolicy = "default" | "ephemeral" | "archive";
export type DurableSensitivity = "normal" | "sensitive" | "restricted";
export type DurableSourceVisibility = "full" | "summary" | "hidden";

export interface DurablePublicContracts {
  recall_allowed: boolean;
  retention_policy: DurableRetentionPolicy;
  sensitivity: DurableSensitivity;
  source_visibility: DurableSourceVisibility;
  expires_at?: string;
}

export interface DurableExecutor {
  query(sql: string, params?: unknown[]): Promise<{ rows?: any[] } | unknown>;
}

export interface DurableSource {
  kind?: string;
  uri?: string;
  id?: string;
  observed_at?: string | Date;
}

export interface DurableEntityInput {
  id?: string;
  type?: string;
  name: string;
  aliases?: string[];
  role?: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

export interface DurableEdgeInput {
  id?: string;
  type: DurableEdgeType;
  target_memory_id?: string;
  source_entity_id?: string;
  target_entity_id?: string;
  weight?: number;
  confidence?: number;
  provenance?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  valid_from?: string | Date;
  valid_to?: string | Date;
}

export interface DurableRememberInput {
  id?: string;
  content: string;
  user_id?: string;
  project_id?: string;
  actor_id?: string;
  facets?: Record<string, unknown>;
  contracts?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  entities?: DurableEntityInput[];
  edges?: DurableEdgeInput[];
  source?: DurableSource;
  embedding?: number[];
  now?: Date;
}

export interface DurableRememberResult {
  id: string;
  status: "stored";
}

export type DurableRecallMode = "strict" | "historical" | "associative";

export interface DurableRecallInput {
  query: string;
  mode?: DurableRecallMode;
  at_time?: string | Date;
  limit?: number;
  user_id?: string;
  project_id?: string;
  source?: DurableSource;
  embedding?: number[];
  candidate_ids?: string[];
}

export interface DurableRecallResult {
  query: string;
  mode: DurableRecallMode;
  results: Array<{
    id: string;
    content: string;
    score: number;
    facets: unknown;
    contracts: unknown;
    metadata: unknown;
    salience: number;
    confidence: number;
    recorded_at: string | null;
    valid_from: string | null;
    valid_to: string | null;
    provenance_summary: {
      count: number;
      hidden: boolean;
      source_kinds: string[];
      source_ids: string[];
      source_uris: string[];
    };
    provenance: unknown[];
    contradictions: unknown[];
  }>;
}

export interface DurableGraphTraversalInput {
  memory_id: string;
  user_id?: string;
  project_id?: string;
  max_depth?: number;
  at_time?: string | Date;
}

export interface DurableGraphTraversalResult {
  start_memory_id: string;
  nodes: Array<{
    id: string;
    content: string | null;
    depth: number;
  }>;
  edges: Array<{
    id: string;
    source_memory_id: string;
    target_memory_id: string | null;
    edge_type: DurableEdgeType;
    weight: number;
    confidence: number;
    provenance: Record<string, unknown>;
    metadata: Record<string, unknown>;
    valid_from: string | null;
    valid_to: string | null;
    depth: number;
  }>;
  explain: {
    reasons: string[];
  };
  audit_trace: Array<{
    event_type: "graph.traverse.edge";
    target_table: "edges";
    target_id: string;
    depth: number;
    edge_type: DurableEdgeType;
    recorded_at: string;
  }>;
}

export interface DurableTemporalGraphQueryInput {
  user_id?: string;
  project_id?: string;
  memory_id?: string;
  edge_type?: DurableEdgeType;
  at_time?: string | Date;
  from?: string | Date;
  to?: string | Date;
  limit?: number;
}

export interface DurableTemporalGraphQueryResult {
  edges: Array<{
    id: string;
    source_memory_id: string;
    target_memory_id: string | null;
    edge_type: DurableEdgeType;
    confidence: number;
    weight: number;
    valid_from: string | null;
    valid_to: string | null;
    source_content: string | null;
    target_content: string | null;
  }>;
}

export interface ExecutableEdgePlan {
  edge_id: string;
  edge_type: DurableEdgeType;
  source_memory_id?: string | null;
  target_memory_id: string | null;
  operation: string | null;
  metadata: Record<string, unknown>;
}

export type ExecutableEdgeHandler = (
  plan: ExecutableEdgePlan,
) => Promise<unknown> | unknown;

export interface DurableExecutableEdgeInput {
  edge_id: string;
  edge_type: DurableEdgeType;
  source_memory_id?: string | null;
  target_memory_id?: string | null;
  user_id?: string;
  project_id?: string | null;
  metadata?: Record<string, unknown>;
  now?: Date;
}

export interface MoveDurableMemoryTierInput {
  id: string;
  tier: DurableMemoryTier;
  user_id?: string;
  project_id?: string;
  reason?: string;
  now?: Date;
}

export interface DurableExplainInput {
  id: string;
  recall?: {
    query?: string;
    mode?: DurableRecallMode;
  };
}

export interface DurableExplainResult {
  id: string;
  content: string;
  facets: unknown;
  contracts: unknown;
  metadata: unknown;
  bitemporal: {
    valid_from: string | null;
    valid_to: string | null;
    observed_at: string | null;
    recorded_at: string | null;
    superseded_at: string | null;
  };
  confidence: {
    salience: number;
    confidence: number;
  };
  score_components: {
    confidence: number;
    salience: number;
    provenance: number;
    contradiction_penalty: number;
    contract_penalty: number;
    contracts: Record<string, unknown>;
  };
  recall_score_inputs?: {
    query: string;
    mode: DurableRecallMode;
    confidence: number;
    salience: number;
    provenance: number;
    semantic: number;
    contradiction_penalty: number;
    contract_penalty: number;
    score: number;
  };
  reasons: string[];
  provenance: unknown[];
  contradictions: unknown[];
  inference_path: unknown[];
  versions: unknown[];
  audit_events: unknown[];
}

export interface DurableDeleteInput {
  id: string;
  user_id?: string;
  actor_id?: string;
  reason?: string;
  now?: Date;
}

export interface DurableGetInput {
  id: string;
  user_id?: string;
  project_id?: string;
}

export interface DurableListInput {
  user_id?: string;
  project_id?: string;
  limit?: number;
  offset?: number;
}

export interface DurableMemorySummary {
  id: string;
  user_id: string | null;
  project_id: string | null;
  content: string;
  facets: unknown;
  contracts: unknown;
  metadata: unknown;
  bitemporal: {
    valid_from: string | null;
    valid_to: string | null;
    observed_at: string | null;
    recorded_at: string | null;
    superseded_at: string | null;
  };
  confidence: {
    salience: number;
    confidence: number;
  };
  provenance_count: number;
  version_count: number;
}

export interface DurableListResult {
  items: DurableMemorySummary[];
  limit: number;
  offset: number;
}

export interface DurableUpdateInput {
  id: string;
  user_id?: string;
  content?: string;
  facets?: Record<string, unknown>;
  contracts?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  expected_version?: number;
  now?: Date;
}

export interface DurableUpdateResult {
  id: string;
  version: number;
  status: "updated";
}

export interface DurableReinforceInput {
  id: string;
  user_id?: string;
  boost?: number;
  now?: Date;
}

export interface DurableReinforceResult {
  id: string;
  salience: number;
  status: "reinforced";
}

export interface DurableDecayJobInput {
  user_id?: string;
  project_id?: string;
  actor_id?: string;
  limit?: number;
  dry_run?: boolean;
  now?: Date;
}

export interface DurableDecayJobResult {
  scanned: number;
  changed: number;
  dry_run: boolean;
  memories: Array<{
    id: string;
    salience_before: number;
    salience_after: number;
    memory_tier: DurableMemoryTier;
  }>;
}

export class DurableConflictError extends Error {
  code = "conflict";

  constructor(
    readonly expected_version: number,
    readonly current_version: number,
  ) {
    super(
      `memory version conflict: expected ${expected_version}, current ${current_version}`,
    );
  }
}

export interface DurableContradictionInput {
  id?: string;
  user_id?: string;
  project_id?: string;
  memory_id: string;
  contradicts_memory_id: string;
  conflict_group_id?: string;
  resolution_policy?: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
  now?: Date;
}

export interface DurableContradictionResult {
  id: string;
  status: "open";
  conflict_group_id: string | null;
  resolution_policy: string;
}

export interface DurableResolveContradictionInput {
  id: string;
  resolution: string;
  actor_id?: string;
  reason?: string;
  user_id?: string;
  now?: Date;
}

export interface DurableResolveContradictionResult {
  id: string;
  status: "resolved";
  resolution: string;
  resolved_by: string | null;
  resolution_reason: string | null;
}

export const CONSOLIDATION_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
  "canceled",
] as const;

export type DurableConsolidationStatus =
  (typeof CONSOLIDATION_STATUSES)[number];

export interface DurableConsolidationInput {
  id?: string;
  user_id?: string;
  project_id?: string;
  idempotency_key?: string;
  scope?: Record<string, unknown>;
  source_memory_ids?: string[];
  metadata?: Record<string, unknown>;
  now?: Date;
}

export interface DurableConsolidationResult {
  id: string;
  status: Extract<DurableConsolidationStatus, "pending">;
}

export interface DurableConsolidationClaimInput {
  worker_id: string;
  user_id?: string;
  project_id?: string;
  now?: Date;
}

export interface DurableConsolidationJob {
  id: string;
  user_id: string;
  project_id: string | null;
  scope: Record<string, unknown>;
  source_memory_ids: string[];
  status: Extract<DurableConsolidationStatus, "running">;
  worker_id: string;
}

export interface DurableConsolidationCompleteInput {
  id: string;
  result_memory_id: string;
  source_memory_ids?: string[];
  summary?: string;
  metadata?: Record<string, unknown>;
  now?: Date;
}

export interface DurableConsolidationCompleteResult {
  id: string;
  status: Extract<DurableConsolidationStatus, "completed">;
  result_id: string;
  result_memory_id: string;
}

export interface ConsolidationRecallEvalInput {
  baseline: {
    recall_score: number;
    noise_score: number;
  };
  candidate: {
    recall_score: number;
    noise_score: number;
  };
  min_recall_gain?: number;
  max_noise_increase?: number;
}

export interface ConsolidationRecallEvalResult {
  passed: boolean;
  recall_gain: number;
  noise_delta: number;
}

export interface WorkingMemoryEventInput {
  id?: string;
  user_id?: string;
  project_id?: string;
  source: {
    kind: "text" | "document" | "url" | "provider_event" | string;
    uri?: string;
    id?: string;
    content_type?: string;
  };
  content: string | Buffer;
  metadata?: Record<string, unknown>;
  contracts?: Record<string, unknown>;
  observed_at?: string | Date;
  now?: Date;
}

export interface WorkingMemoryEventResult {
  id: string;
  status: "pending";
  extraction: {
    automatic: false;
    status: "disabled";
  };
}

export interface ExtractionCandidateInput {
  id?: string;
  event_id: string;
  user_id?: string;
  project_id?: string;
  content: string;
  facets?: Record<string, unknown>;
  entities?: DurableEntityInput[];
  edges?: DurableEdgeInput[];
  contradictions?: Array<{
    id?: string;
    contradicts_memory_id: string;
    conflict_group_id?: string;
    resolution_policy?: string;
    confidence?: number;
    metadata?: Record<string, unknown>;
  }>;
  contracts?: Record<string, unknown>;
  confidence?: number;
  metadata?: Record<string, unknown>;
  now?: Date;
}

export interface ExtractionCandidateResult {
  id: string;
  status: "pending";
}

export interface PromoteExtractionCandidateInput {
  candidate_id: string;
  memory_id?: string;
  source?: DurableSource;
  now?: Date;
}

export interface PromoteExtractionCandidateResult {
  id: string;
  candidate_id: string;
  status: "stored";
}

export interface RejectExtractionCandidateInput {
  candidate_id: string;
  reason: string;
  user_id?: string;
  now?: Date;
}

export interface RejectExtractionCandidateResult {
  id: string;
  status: "rejected";
  reason: string;
}

const ident = (name: string) => `"${name.replace(/"/g, '""')}"`;
const table = (schema: string, name: string) =>
  `${ident(schema)}.${ident(name)}`;

const asJson = (value: unknown) => JSON.stringify(value ?? {});

const asVector = (value: number[] | undefined) =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((item) => Number.isFinite(item))
    ? JSON.stringify(value)
    : null;

const sourceObservedAt = (
  source: DurableSource | undefined,
  fallback: Date,
) => {
  if (!source?.observed_at) return fallback;
  const date =
    source.observed_at instanceof Date
      ? source.observed_at
      : new Date(source.observed_at);
  return Number.isNaN(date.getTime()) ? fallback : date;
};

const recallTime = (value: string | Date | undefined) => {
  if (!value) return new Date();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const plural = (count: number, singular: string) =>
  `${count} ${singular}${count === 1 ? "" : "s"}`;

const explainReasons = (input: {
  confidence: number;
  provenance: unknown[];
  contradictions: unknown[];
  contracts: Record<string, unknown>;
}) => [
  `confidence ${input.confidence}`,
  plural(input.provenance.length, "provenance source"),
  plural(input.contradictions.length, "open contradiction"),
  input.contracts.recall_allowed === false
    ? "recall blocked by contract"
    : "recall allowed by contract",
];

const recallScoreInputs = (input: {
  query?: string;
  mode?: DurableRecallMode;
  confidence: number;
  salience: number;
  provenance: number;
  semantic: number;
  contradiction_penalty: number;
  contract_penalty: number;
  score: number;
}) => {
  if (!input.query?.trim()) return undefined;
  return {
    query: input.query,
    mode: input.mode || "associative",
    confidence: input.confidence,
    salience: input.salience,
    provenance: input.provenance,
    semantic: input.semantic,
    contradiction_penalty: input.contradiction_penalty,
    contract_penalty: input.contract_penalty,
    score: input.score,
  };
};

const SENSITIVE_METADATA_KEYS = new Set([
  "api_key",
  "apikey",
  "authorization",
  "auth",
  "cookie",
  "password",
  "secret",
  "token",
]);

const redactSensitiveMetadata = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(redactSensitiveMetadata);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
      key,
      SENSITIVE_METADATA_KEYS.has(key.toLowerCase())
        ? "[redacted]"
        : redactSensitiveMetadata(nested),
    ]),
  );
};

const redactProvenanceRows = (rows: unknown[]) =>
  rows.map((row) => {
    if (!row || typeof row !== "object") return row;
    const record = row as Record<string, unknown>;
    return {
      ...record,
      metadata: redactSensitiveMetadata(record.metadata || {}),
    };
  });

const uniqueStrings = (values: unknown[]) => [
  ...new Set(
    values.filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    ),
  ),
];

const provenanceSummary = (rows: unknown[], hidden: boolean) => {
  const records = rows.filter(
    (row): row is Record<string, unknown> => !!row && typeof row === "object",
  );
  return {
    count: rows.length,
    hidden,
    source_kinds: uniqueStrings(records.map((row) => row.source_kind)),
    source_ids: uniqueStrings(records.map((row) => row.source_id)),
    source_uris: uniqueStrings(records.map((row) => row.source_uri)),
  };
};

const publicAuditEvents = (rows: unknown[]) =>
  rows.map((row) => {
    if (!row || typeof row !== "object") return row;
    const {
      target_table: _targetTable,
      target_id: _targetId,
      before_state: _beforeState,
      after_state: _afterState,
      ...publicRow
    } = row as Record<string, unknown>;
    return publicRow;
  });

const bounded = (value: number | undefined, fallback: number) => {
  if (value === undefined || Number.isNaN(value)) return fallback;
  return Math.max(0, Math.min(value, 1));
};

const allowedEdgeType = (type: string): DurableEdgeType => {
  if (!ALLOWED_DURABLE_EDGE_TYPES.includes(type as DurableEdgeType)) {
    throw new Error(
      `edge type must be one of ${ALLOWED_DURABLE_EDGE_TYPES.join(", ")}`,
    );
  }
  return type as DurableEdgeType;
};

const oneOf = <T extends string>(
  field: string,
  value: unknown,
  allowed: readonly T[],
  fallback: T,
) => {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new Error(`${field} must be one of ${allowed.join(", ")}`);
  }
  return value as T;
};

export function normalizeDurableContracts(
  contracts: Record<string, unknown> | undefined,
): DurablePublicContracts {
  const input = contracts || {};
  if (
    input.recall_allowed !== undefined &&
    typeof input.recall_allowed !== "boolean"
  ) {
    throw new Error("recall_allowed must be a boolean");
  }
  const normalized: DurablePublicContracts = {
    recall_allowed:
      input.recall_allowed === undefined ? true : input.recall_allowed,
    retention_policy: oneOf(
      "retention_policy",
      input.retention_policy,
      ["default", "ephemeral", "archive"] as const,
      "default",
    ),
    sensitivity: oneOf(
      "sensitivity",
      input.sensitivity,
      ["normal", "sensitive", "restricted"] as const,
      "normal",
    ),
    source_visibility: oneOf(
      "source_visibility",
      input.source_visibility,
      ["full", "summary", "hidden"] as const,
      "summary",
    ),
  };
  if (input.expires_at !== undefined) {
    if (
      typeof input.expires_at !== "string" ||
      Number.isNaN(Date.parse(input.expires_at))
    ) {
      throw new Error("expires_at must be an ISO timestamp");
    }
    normalized.expires_at = new Date(input.expires_at).toISOString();
  }
  return normalized;
}

const isoOrNull = (value: string | Date | undefined) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const auditActor = (actorId: string | undefined, userId?: string) => {
  const id = actorId?.trim() || userId || "system";
  return { id, type: id === "system" ? "system" : "user" };
};

const mapMemorySummary = (row: any): DurableMemorySummary => ({
  id: row.id,
  user_id: row.user_id ?? null,
  project_id: row.project_id ?? null,
  content: row.content,
  facets: row.facets || {},
  contracts: row.contracts || {},
  metadata: row.metadata || {},
  bitemporal: {
    valid_from: row.valid_from ?? null,
    valid_to: row.valid_to ?? null,
    observed_at: row.observed_at ?? null,
    recorded_at: row.recorded_at ?? null,
    superseded_at: row.superseded_at ?? null,
  },
  confidence: {
    salience: Number(row.salience ?? 0),
    confidence: Number(row.confidence ?? 0),
  },
  provenance_count: Number(row.provenance_count ?? 0),
  version_count: Number(row.version_count ?? 0),
});

export async function rememberDurableMemory(
  db: DurableExecutor,
  input: DurableRememberInput,
  schema = process.env.OM_PG_SCHEMA || "public",
): Promise<DurableRememberResult> {
  if (!input.content?.trim()) {
    throw new Error("content is required");
  }

  const id = input.id || crypto.randomUUID();
  const now = input.now || new Date();
  const userId = input.user_id || "anonymous";
  const memories = table(schema, "memories");
  const memoryVersions = table(schema, "memory_versions");
  const entities = table(schema, "entities");
  const memoryEntities = table(schema, "memory_entities");
  const edges = table(schema, "edges");
  const provenance = table(schema, "provenance");
  const auditLog = table(schema, "audit_log");
  const contracts = normalizeDurableContracts(input.contracts);
  const actor = auditActor(input.actor_id, userId);
  const metadata = enrichDurableMetadata(input.content, input.metadata);

  const memoryState = {
    id,
    user_id: userId,
    project_id: input.project_id || null,
    content: input.content,
    facets: input.facets || {},
    contracts,
    metadata,
    observed_at: sourceObservedAt(input.source, now).toISOString(),
    recorded_at: now.toISOString(),
  };

  await db.query("BEGIN");
  try {
    await db.query(
      `insert into ${memories}
        (id,user_id,project_id,content,facets,contracts,metadata,observed_at,recorded_at,embedding)
       values ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9,$10::vector)`,
      [
        id,
        userId,
        input.project_id || null,
        input.content,
        asJson(input.facets),
        JSON.stringify(contracts),
        JSON.stringify(metadata),
        memoryState.observed_at,
        memoryState.recorded_at,
        asVector(input.embedding),
      ],
    );

    await db.query(
      `insert into ${memoryVersions}
        (id,memory_id,version,content,facets,contracts,metadata,recorded_at)
       values ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8)`,
      [
        crypto.randomUUID(),
        id,
        1,
        input.content,
        asJson(input.facets),
        JSON.stringify(contracts),
        JSON.stringify(metadata),
        memoryState.recorded_at,
      ],
    );

    if (input.source) {
      await db.query(
        `insert into ${provenance}
          (id,memory_id,source_kind,source_uri,source_id,extraction_method,trust_score,observed_at,metadata,recorded_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)`,
        [
          crypto.randomUUID(),
          id,
          input.source.kind || "unknown",
          input.source.uri || null,
          input.source.id || null,
          "api",
          0.5,
          memoryState.observed_at,
          "{}",
          memoryState.recorded_at,
        ],
      );
    }

    for (const entity of input.entities || []) {
      if (!entity.name?.trim()) continue;
      const entityId = entity.id || crypto.randomUUID();
      await db.query(
        `insert into ${entities}
          (id,user_id,project_id,entity_type,canonical_name,aliases,metadata,created_at,updated_at)
         values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9)
         on conflict(id) do update set
          user_id=excluded.user_id,
          project_id=excluded.project_id,
          entity_type=excluded.entity_type,
          canonical_name=excluded.canonical_name,
          aliases=excluded.aliases,
          metadata=excluded.metadata,
          updated_at=excluded.updated_at`,
        [
          entityId,
          userId,
          input.project_id || null,
          entity.type || "unknown",
          entity.name.trim(),
          JSON.stringify(entity.aliases || []),
          asJson(entity.metadata),
          memoryState.recorded_at,
          memoryState.recorded_at,
        ],
      );
      await db.query(
        `insert into ${memoryEntities}
          (memory_id,entity_id,role,confidence)
         values ($1,$2,$3,$4)
         on conflict(memory_id, entity_id) do update set
          role=excluded.role,
          confidence=excluded.confidence`,
        [id, entityId, entity.role || null, bounded(entity.confidence, 1)],
      );
    }

    for (const edge of input.edges || []) {
      if (!edge.type?.trim()) continue;
      await db.query(
        `insert into ${edges}
          (id,user_id,project_id,source_memory_id,target_memory_id,source_entity_id,target_entity_id,edge_type,weight,confidence,provenance,metadata,valid_from,valid_to,recorded_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13,$14,$15)`,
        [
          edge.id || crypto.randomUUID(),
          userId,
          input.project_id || null,
          id,
          edge.target_memory_id || null,
          edge.source_entity_id || null,
          edge.target_entity_id || null,
          allowedEdgeType(edge.type),
          bounded(edge.weight, 1),
          bounded(edge.confidence, 1),
          asJson(edge.provenance),
          asJson(edge.metadata),
          isoOrNull(edge.valid_from),
          isoOrNull(edge.valid_to),
          memoryState.recorded_at,
        ],
      );
    }

    await db.query(
      `insert into ${auditLog}
        (id,user_id,project_id,actor_id,actor_type,event_type,target_table,target_id,operation,before_state,after_state,metadata,recorded_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13)`,
      [
        crypto.randomUUID(),
        userId,
        input.project_id || null,
        actor.id,
        actor.type,
        "memory.remember",
        "memories",
        id,
        "insert",
        null,
        JSON.stringify(memoryState),
        "{}",
        memoryState.recorded_at,
      ],
    );

    await db.query("COMMIT");
    return { id, status: "stored" };
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  }
}

export async function recallDurableMemories(
  db: DurableExecutor,
  input: DurableRecallInput,
  schema = process.env.OM_PG_SCHEMA || "public",
): Promise<DurableRecallResult> {
  if (!input.query?.trim()) {
    throw new Error("query is required");
  }

  const mode = input.mode || "associative";
  if (!["strict", "historical", "associative"].includes(mode)) {
    throw new Error("mode must be strict, historical, or associative");
  }
  const atTime = recallTime(input.at_time).toISOString();
  const limit = Math.max(1, Math.min(input.limit || 10, 100));
  const memories = table(schema, "memories");
  const provenance = table(schema, "provenance");
  const contradictions = table(schema, "contradictions");
  const params: unknown[] = [`%${input.query}%`, atTime, limit];
  const useVectorRecall =
    Array.isArray(input.embedding) &&
    input.embedding.length > 0 &&
    input.embedding.every((value) => Number.isFinite(value));
  const filters = [
    useVectorRecall ? `$1::text is not null` : `m.content ilike $1`,
    `(m.valid_from is null or m.valid_from <= $2)`,
    `(m.valid_to is null or m.valid_to > $2)`,
    `m.recorded_at <= $2`,
    `m.superseded_at is null`,
    `(m.contracts->>'expires_at' is null or (m.contracts->>'expires_at')::timestamptz > $2)`,
  ];
  let vectorDistance = "null::double precision as vector_distance";

  if (useVectorRecall) {
    params.push(JSON.stringify(input.embedding));
    vectorDistance = `m.embedding <=> $${params.length}::vector as vector_distance`;
    filters.push(`m.embedding is not null`);
  }

  const candidateIds = Array.from(
    new Set((input.candidate_ids || []).filter((id) => id?.trim())),
  );
  let candidateOrder = "";
  if (candidateIds.length) {
    params.push(candidateIds);
    const candidateParam = params.length;
    filters.push(`m.id = any($${candidateParam}::text[])`);
    candidateOrder = `array_position($${candidateParam}::text[], m.id::text) asc`;
  }

  if (input.user_id) {
    params.push(input.user_id);
    filters.push(`m.user_id = $${params.length}`);
  }

  if (input.project_id) {
    params.push(input.project_id);
    filters.push(`(m.project_id = $${params.length} or m.project_id is null)`);
  }

  if (input.source?.kind) {
    params.push(input.source.kind);
    filters.push(`exists (
      select 1 from ${provenance} ps
      where ps.memory_id = m.id and ps.source_kind = $${params.length}
    )`);
  }

  if (input.source?.id) {
    params.push(input.source.id);
    filters.push(`exists (
      select 1 from ${provenance} ps
      where ps.memory_id = m.id and ps.source_id = $${params.length}
    )`);
  }

  if (input.source?.uri) {
    params.push(input.source.uri);
    filters.push(`exists (
      select 1 from ${provenance} ps
      where ps.memory_id = m.id and ps.source_uri = $${params.length}
    )`);
  }

  if (mode === "strict") {
    filters.push(`jsonb_array_length(coalesce(p.provenance, '[]'::jsonb)) > 0`);
    filters.push(
      `jsonb_array_length(coalesce(c.contradictions, '[]'::jsonb)) = 0`,
    );
    filters.push(`coalesce(m.contracts->>'recall_allowed', 'true') <> 'false'`);
  }

  const order = candidateOrder
    ? `${candidateOrder}, m.recorded_at desc`
    : useVectorRecall
      ? `vector_distance asc, ${mode === "historical" ? "m.recorded_at desc" : "m.confidence desc, m.salience desc, m.recorded_at desc"}`
      : mode === "historical"
        ? "m.recorded_at desc"
        : mode === "strict"
          ? "m.confidence desc, m.recorded_at desc"
          : "m.salience desc, m.confidence desc, m.recorded_at desc";

  const sql = `
    select
      m.id,
      m.content,
      m.facets,
      m.contracts,
      m.metadata,
      m.salience,
      m.confidence,
      m.recorded_at,
      m.valid_from,
      m.valid_to,
      ${vectorDistance},
      coalesce(p.provenance, '[]'::jsonb) as provenance,
      coalesce(c.contradictions, '[]'::jsonb) as contradictions
    from ${memories} m
    left join lateral (
      select jsonb_agg(jsonb_build_object(
        'source_kind', source_kind,
        'source_uri', source_uri,
        'source_id', source_id,
        'trust_score', trust_score,
        'observed_at', observed_at
      )) as provenance
      from ${provenance}
      where memory_id = m.id
    ) p on true
    left join lateral (
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'contradicts_memory_id', c.contradicts_memory_id,
        'status', c.status,
        'confidence', c.confidence
      )) as contradictions
      from ${contradictions} c
      left join ${memories} contradicted on contradicted.id = c.contradicts_memory_id
      where c.memory_id = m.id
        and c.status = 'open'
        and (c.project_id = m.project_id or (c.project_id is null and m.project_id is null))
        and (contradicted.id is null or contradicted.superseded_at is null)
    ) c on true
    where ${filters.join("\n      and ")}
    order by ${order}
    limit $3
  `;

  const result = (await db.query(sql, params)) as { rows?: any[] };
  const rows = result.rows || [];

  return {
    query: input.query,
    mode,
    results: rows.map((row) => {
      const contracts = row.contracts || {};
      const provenanceRows = row.provenance || [];
      const contradictionRows = row.contradictions || [];
      const scored = scoreDurableRecall({
        confidence: Number(row.confidence ?? 0),
        salience: Number(row.salience ?? 0),
        provenance_count: provenanceRows.length,
        contradiction_count: contradictionRows.length,
        recall_allowed: contracts.recall_allowed !== false,
        vector_distance:
          row.vector_distance == null ? null : Number(row.vector_distance),
        text_match: !useVectorRecall,
        lexical_score: computeLexicalScore(input.query, row.content || ""),
      });
      return {
        id: row.id,
        content: row.content,
        score: scored.score,
        facets: row.facets || {},
        contracts,
        metadata: redactSensitiveMetadata(row.metadata || {}) as Record<
          string,
          unknown
        >,
        salience: Number(row.salience ?? 0),
        confidence: Number(row.confidence ?? 0),
        recorded_at: row.recorded_at ?? null,
        valid_from: row.valid_from ?? null,
        valid_to: row.valid_to ?? null,
        provenance_summary: provenanceSummary(
          provenanceRows,
          contracts.source_visibility === "hidden",
        ),
        provenance:
          contracts.source_visibility === "hidden" ? [] : provenanceRows,
        contradictions: contradictionRows,
      };
    }),
  };
}

export async function traverseDurableGraph(
  db: DurableExecutor,
  input: DurableGraphTraversalInput,
  schema = process.env.OM_PG_SCHEMA || "public",
): Promise<DurableGraphTraversalResult> {
  if (!input.memory_id?.trim()) {
    throw new Error("memory_id is required");
  }

  const edges = table(schema, "edges");
  const memories = table(schema, "memories");
  const atTime = recallTime(input.at_time).toISOString();
  const maxDepth = Math.max(1, Math.min(input.max_depth || 1, 5));
  const params: unknown[] = [input.memory_id, atTime, maxDepth];
  const filters = [
    `(e.valid_from is null or e.valid_from <= $2)`,
    `(e.valid_to is null or e.valid_to > $2)`,
    `target.superseded_at is null`,
  ];

  if (input.user_id) {
    params.push(input.user_id);
    filters.push(`e.user_id = $${params.length}`);
    filters.push(`target.user_id = $${params.length}`);
  }

  if (input.project_id) {
    params.push(input.project_id);
    filters.push(`(e.project_id = $${params.length} or e.project_id is null)`);
    filters.push(
      `(target.project_id = $${params.length} or target.project_id is null)`,
    );
  }

  const sql = `
    with recursive graph_edges as (
      select
        e.id as edge_id,
        e.source_memory_id,
        e.target_memory_id,
        e.edge_type,
        e.weight,
        e.confidence,
        e.provenance,
        e.metadata,
        e.valid_from,
        e.valid_to,
        target.content as target_content,
        1 as depth
      from ${edges} e
      join ${memories} target on target.id = e.target_memory_id
      where e.source_memory_id = $1
        and ${filters.join("\n        and ")}
      union all
      select
        e.id as edge_id,
        e.source_memory_id,
        e.target_memory_id,
        e.edge_type,
        e.weight,
        e.confidence,
        e.provenance,
        e.metadata,
        e.valid_from,
        e.valid_to,
        target.content as target_content,
        ge.depth + 1 as depth
      from ${edges} e
      join graph_edges ge on ge.target_memory_id = e.source_memory_id
      join ${memories} target on target.id = e.target_memory_id
      where ge.depth < $3
        and ${filters.join("\n        and ")}
    )
    select *
    from graph_edges
    order by depth asc, confidence desc, weight desc
  `;

  const result = (await db.query(sql, params)) as { rows?: any[] };
  const rows = result.rows || [];
  const nodeMap = new Map<
    string,
    { id: string; content: string | null; depth: number }
  >();
  const recordedAt = new Date().toISOString();
  const mappedEdges = rows.map((row) => {
    if (row.target_memory_id && !nodeMap.has(row.target_memory_id)) {
      nodeMap.set(row.target_memory_id, {
        id: row.target_memory_id,
        content: row.target_content ?? null,
        depth: Number(row.depth ?? 1),
      });
    }
    return {
      id: row.edge_id,
      source_memory_id: row.source_memory_id,
      target_memory_id: row.target_memory_id ?? null,
      edge_type: row.edge_type,
      weight: Number(row.weight ?? 1),
      confidence: Number(row.confidence ?? 1),
      provenance: row.provenance || {},
      metadata: redactSensitiveMetadata(row.metadata || {}) as Record<
        string,
        unknown
      >,
      valid_from: row.valid_from ?? null,
      valid_to: row.valid_to ?? null,
      depth: Number(row.depth ?? 1),
    };
  });

  return {
    start_memory_id: input.memory_id,
    nodes: [...nodeMap.values()],
    edges: mappedEdges,
    explain: {
      reasons: mappedEdges.map(
        (edge) =>
          `depth ${edge.depth}: ${edge.edge_type} edge ${edge.id} selected with confidence ${edge.confidence}`,
      ),
    },
    audit_trace: mappedEdges.map((edge) => ({
      event_type: "graph.traverse.edge",
      target_table: "edges",
      target_id: edge.id,
      depth: edge.depth,
      edge_type: edge.edge_type,
      recorded_at: recordedAt,
    })),
  };
}

export async function queryDurableTemporalGraph(
  db: DurableExecutor,
  input: DurableTemporalGraphQueryInput,
  schema = process.env.OM_PG_SCHEMA || "public",
): Promise<DurableTemporalGraphQueryResult> {
  const edges = table(schema, "edges");
  const memories = table(schema, "memories");
  const limit = Math.max(1, Math.min(input.limit || 100, 500));
  const params: unknown[] = [];
  const filters = [
    "source.superseded_at is null",
    "target.superseded_at is null",
  ];

  const addTemporalFilters = (
    alias: string,
    at?: Date,
    from?: Date,
    to?: Date,
  ) => {
    if (at) {
      params.push(at.toISOString());
      const index = params.length;
      filters.push(
        `(${alias}.valid_from is null or ${alias}.valid_from <= $${index})`,
      );
      filters.push(
        `(${alias}.valid_to is null or ${alias}.valid_to > $${index})`,
      );
    } else if (from || to) {
      const fromIso = (from || new Date(0)).toISOString();
      const toIso = (to || new Date("9999-12-31T00:00:00.000Z")).toISOString();
      params.push(fromIso, toIso);
      const fromIndex = params.length - 1;
      const toIndex = params.length;
      filters.push(
        `(${alias}.valid_from is null or ${alias}.valid_from <= $${toIndex})`,
      );
      filters.push(
        `(${alias}.valid_to is null or ${alias}.valid_to > $${fromIndex})`,
      );
    }
  };

  const at = input.at_time ? recallTime(input.at_time) : undefined;
  const from = input.from ? recallTime(input.from) : undefined;
  const to = input.to ? recallTime(input.to) : undefined;
  for (const alias of ["e", "source", "target"]) {
    addTemporalFilters(alias, at, from, to);
  }

  if (input.user_id) {
    params.push(input.user_id);
    const index = params.length;
    filters.push(`e.user_id = $${index}`);
    filters.push(`source.user_id = $${index}`);
    filters.push(`target.user_id = $${index}`);
  }
  if (input.project_id) {
    params.push(input.project_id);
    const index = params.length;
    filters.push(`(e.project_id = $${index} or e.project_id is null)`);
    filters.push(
      `(source.project_id = $${index} or source.project_id is null)`,
    );
    filters.push(
      `(target.project_id = $${index} or target.project_id is null)`,
    );
  }
  if (input.memory_id) {
    params.push(input.memory_id);
    filters.push(
      `(e.source_memory_id = $${params.length} or e.target_memory_id = $${params.length})`,
    );
  }
  if (input.edge_type) {
    params.push(allowedEdgeType(input.edge_type));
    filters.push(`e.edge_type = $${params.length}`);
  }
  params.push(limit);

  const result = (await db.query(
    `select
       e.id as edge_id,
       e.source_memory_id,
       e.target_memory_id,
       e.edge_type,
       e.confidence,
       e.weight,
       e.valid_from,
       e.valid_to,
       source.content as source_content,
       target.content as target_content
     from ${edges} e
     join ${memories} source on source.id = e.source_memory_id
     join ${memories} target on target.id = e.target_memory_id
     where ${filters.join("\n       and ")}
     order by e.confidence desc, e.weight desc, e.valid_from desc nulls last
     limit $${params.length}`,
    params,
  )) as { rows?: any[] };

  return {
    edges: (result.rows || []).map((row) => ({
      id: row.edge_id,
      source_memory_id: row.source_memory_id,
      target_memory_id: row.target_memory_id ?? null,
      edge_type: row.edge_type,
      confidence: Number(row.confidence ?? 1),
      weight: Number(row.weight ?? 1),
      valid_from: row.valid_from ?? null,
      valid_to: row.valid_to ?? null,
      source_content: row.source_content ?? null,
      target_content: row.target_content ?? null,
    })),
  };
}

export function buildExecutableEdgePlan(edge: {
  id: string;
  edge_type: DurableEdgeType;
  source_memory_id?: string | null;
  target_memory_id?: string | null;
  metadata?: Record<string, unknown>;
}): ExecutableEdgePlan {
  const operation =
    typeof edge.metadata?.operation === "string" &&
    edge.metadata.operation.trim()
      ? edge.metadata.operation
      : null;
  return {
    edge_id: edge.id,
    edge_type: allowedEdgeType(edge.edge_type),
    source_memory_id: edge.source_memory_id ?? null,
    target_memory_id: edge.target_memory_id ?? null,
    operation,
    metadata: edge.metadata || {},
  };
}

export async function executeExecutableEdgePlan(
  plan: ExecutableEdgePlan,
  handlers: Record<string, ExecutableEdgeHandler>,
) {
  if (!plan.operation) {
    throw new Error("executable edge plan has no operation");
  }
  const handler = handlers[plan.operation];
  if (!handler) {
    throw new Error(
      `executable edge handler is required for ${plan.operation}`,
    );
  }
  return handler(plan);
}

const executableEdgeEvent = (edgeType: DurableEdgeType) => `edge.${edgeType}`;

export async function executeDurableEdgeHandler(
  db: DurableExecutor,
  input: DurableExecutableEdgeInput,
  schema = process.env.OM_PG_SCHEMA || "public",
) {
  const edgeType = allowedEdgeType(input.edge_type);
  if (
    !["supersedes", "contradicts", "derives_from", "same_as"].includes(edgeType)
  ) {
    throw new Error(`edge handler is not required for ${edgeType}`);
  }
  if (!input.source_memory_id?.trim()) {
    throw new Error("source_memory_id is required");
  }
  if (!input.target_memory_id?.trim()) {
    throw new Error("target_memory_id is required");
  }

  const memories = table(schema, "memories");
  const contradictions = table(schema, "contradictions");
  const inferences = table(schema, "inferences");
  const auditLog = table(schema, "audit_log");
  const now = (input.now || new Date()).toISOString();
  const userId = input.user_id || "anonymous";
  const projectId = input.project_id || null;

  await db.query("BEGIN");
  try {
    if (edgeType === "supersedes") {
      await db.query(
        `update ${memories}
         set valid_to = coalesce(valid_to, $1), superseded_at = coalesce(superseded_at, $1)
         where id = $2 and superseded_at is null`,
        [now, input.target_memory_id],
      );
      await db.query(
        `update ${memories}
         set salience = least(1, salience + 0.05)
         where id = $1`,
        [input.source_memory_id],
      );
    } else if (edgeType === "contradicts") {
      await db.query(
        `insert into ${contradictions}
          (id,user_id,project_id,memory_id,contradicts_memory_id,status,confidence,metadata,created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`,
        [
          crypto.randomUUID(),
          userId,
          projectId,
          input.source_memory_id,
          input.target_memory_id,
          "open",
          bounded(Number(input.metadata?.confidence), 1),
          asJson(input.metadata),
          now,
        ],
      );
      await db.query(
        `update ${memories}
         set confidence = greatest(0, confidence - 0.1)
         where id in ($1,$2)`,
        [input.source_memory_id, input.target_memory_id],
      );
    } else if (edgeType === "derives_from") {
      await db.query(
        `insert into ${inferences}
          (id,memory_id,derived_from,inference_method,confidence,metadata,recorded_at)
         values ($1,$2,$3::jsonb,$4,$5,$6::jsonb,$7)`,
        [
          crypto.randomUUID(),
          input.source_memory_id,
          JSON.stringify([input.target_memory_id]),
          String(input.metadata?.inference_method || "edge"),
          bounded(Number(input.metadata?.confidence), 0.8),
          asJson(input.metadata),
          now,
        ],
      );
    } else if (edgeType === "same_as") {
      await db.query(
        `update ${memories}
         set metadata = coalesce(metadata, '{}'::jsonb) || $1::jsonb
         where id in ($2,$3)`,
        [
          JSON.stringify({
            same_as: [input.source_memory_id, input.target_memory_id],
          }),
          input.source_memory_id,
          input.target_memory_id,
        ],
      );
    }

    await db.query(
      `insert into ${auditLog}
        (id,user_id,project_id,event_type,target_table,target_id,operation,before_state,after_state,metadata,recorded_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11)`,
      [
        crypto.randomUUID(),
        userId,
        projectId,
        executableEdgeEvent(edgeType),
        "edges",
        input.edge_id,
        edgeType,
        null,
        JSON.stringify({
          edge_id: input.edge_id,
          edge_type: edgeType,
          source_memory_id: input.source_memory_id,
          target_memory_id: input.target_memory_id,
        }),
        asJson(input.metadata),
        now,
      ],
    );
    await db.query("COMMIT");
    return { edge_id: input.edge_id, edge_type: edgeType, status: "executed" };
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  }
}

export async function moveDurableMemoryTier(
  db: DurableExecutor,
  input: MoveDurableMemoryTierInput,
  schema = process.env.OM_PG_SCHEMA || "public",
) {
  if (!input.id?.trim()) throw new Error("id is required");
  if (!["active", "warm", "cold", "archived"].includes(input.tier)) {
    throw new Error("tier must be active, warm, cold, or archived");
  }

  const memories = table(schema, "memories");
  const auditLog = table(schema, "audit_log");
  const now = (input.now || new Date()).toISOString();
  const params: unknown[] = [input.tier, input.id];
  const filters = ["id = $2", "superseded_at is null"];
  if (input.user_id) {
    params.push(input.user_id);
    filters.push(`user_id = $${params.length}`);
  }
  if (input.project_id) {
    params.push(input.project_id);
    filters.push(`project_id = $${params.length}`);
  }

  await db.query("BEGIN");
  try {
    const result = (await db.query(
      `update ${memories}
       set memory_tier = $1
       where ${filters.join(" and ")}
       returning id,memory_tier`,
      params,
    )) as { rows?: any[] };
    const row = result.rows?.[0];
    if (!row) {
      await db.query("COMMIT");
      return null;
    }

    await db.query(
      `insert into ${auditLog}
        (id,user_id,project_id,event_type,target_table,target_id,operation,before_state,after_state,metadata,recorded_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11)`,
      [
        crypto.randomUUID(),
        input.user_id || null,
        input.project_id || null,
        "memory.tier",
        "memories",
        input.id,
        "update",
        null,
        JSON.stringify({ id: input.id, memory_tier: input.tier }),
        JSON.stringify({ reason: input.reason || null }),
        now,
      ],
    );
    await db.query("COMMIT");
    return {
      id: row.id || input.id,
      tier: (row.memory_tier || input.tier) as DurableMemoryTier,
    };
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  }
}

export async function explainDurableMemory(
  db: DurableExecutor,
  input: DurableExplainInput,
  schema = process.env.OM_PG_SCHEMA || "public",
): Promise<DurableExplainResult | null> {
  if (!input.id?.trim()) {
    throw new Error("id is required");
  }

  const memories = table(schema, "memories");
  const memoryVersions = table(schema, "memory_versions");
  const provenance = table(schema, "provenance");
  const contradictions = table(schema, "contradictions");
  const inferences = table(schema, "inferences");
  const auditLog = table(schema, "audit_log");

  const sql = `
    select
      m.id,
      m.content,
      m.facets,
      m.contracts,
      m.metadata,
      m.salience,
      m.confidence,
      m.valid_from,
      m.valid_to,
      m.observed_at,
      m.recorded_at,
      m.superseded_at,
      coalesce(p.provenance, '[]'::jsonb) as provenance,
      coalesce(c.contradictions, '[]'::jsonb) as contradictions,
      coalesce(i.inference_path, '[]'::jsonb) as inference_path,
      coalesce(v.versions, '[]'::jsonb) as versions,
      coalesce(a.audit_events, '[]'::jsonb) as audit_events
    from ${memories} m
    left join lateral (
      select jsonb_agg(jsonb_build_object(
        'source_kind', source_kind,
        'source_uri', source_uri,
        'source_id', source_id,
        'extraction_method', extraction_method,
        'trust_score', trust_score,
        'metadata', metadata,
        'observed_at', observed_at,
        'recorded_at', recorded_at
      ) order by recorded_at desc) as provenance
      from ${provenance}
      where memory_id = m.id
    ) p on true
    left join lateral (
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'contradicts_memory_id', contradicts_memory_id,
        'status', status,
        'confidence', confidence,
        'resolution', resolution,
        'recorded_at', recorded_at
      ) order by recorded_at desc) as contradictions
      from ${contradictions}
      where memory_id = m.id or contradicts_memory_id = m.id
    ) c on true
    left join lateral (
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'inference_method', inference_method,
        'derived_from', derived_from,
        'memory_id', memory_id,
        'confidence', confidence,
        'metadata', metadata,
        'recorded_at', recorded_at
      ) order by recorded_at desc) as inference_path
      from ${inferences}
      where memory_id = m.id
    ) i on true
    left join lateral (
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'version', version,
        'content', content,
        'facets', facets,
        'contracts', contracts,
        'metadata', metadata,
        'recorded_at', recorded_at
      ) order by version desc) as versions
      from ${memoryVersions}
      where memory_id = m.id
    ) v on true
    left join lateral (
      select jsonb_agg(jsonb_build_object(
        'event_type', event_type,
        'operation', operation,
        'target_table', target_table,
        'recorded_at', recorded_at,
        'metadata', metadata
      ) order by recorded_at desc) as audit_events
      from ${auditLog}
      where target_table = 'memories' and target_id = m.id
    ) a on true
    where m.id = $1
    limit 1
  `;

  const result = (await db.query(sql, [input.id])) as { rows?: any[] };
  const row = result.rows?.[0];
  if (!row) return null;
  const contracts = row.contracts || {};
  const rawProvenanceRows = redactProvenanceRows(row.provenance || []);
  const provenanceRows =
    contracts.source_visibility === "hidden" ? [] : rawProvenanceRows;
  const contradictionRows = row.contradictions || [];
  const confidence = Number(row.confidence ?? 0);
  const salience = Number(row.salience ?? 0);
  const scored = scoreDurableRecall({
    confidence,
    salience,
    provenance_count: rawProvenanceRows.length,
    contradiction_count: contradictionRows.length,
    recall_allowed: contracts.recall_allowed !== false,
    text_match: Boolean(input.recall?.query?.trim()),
  });

  return {
    id: row.id,
    content: row.content,
    facets: row.facets || {},
    contracts: row.contracts || {},
    metadata: redactSensitiveMetadata(row.metadata || {}) as Record<
      string,
      unknown
    >,
    bitemporal: {
      valid_from: row.valid_from ?? null,
      valid_to: row.valid_to ?? null,
      observed_at: row.observed_at ?? null,
      recorded_at: row.recorded_at ?? null,
      superseded_at: row.superseded_at ?? null,
    },
    confidence: {
      salience,
      confidence,
    },
    score_components: {
      confidence: scored.confidence,
      salience: scored.salience,
      provenance: scored.provenance,
      contradiction_penalty: scored.contradiction_penalty,
      contract_penalty: scored.contract_penalty,
      contracts,
    },
    recall_score_inputs: recallScoreInputs({
      query: input.recall?.query,
      mode: input.recall?.mode,
      confidence: scored.confidence,
      salience: scored.salience,
      provenance: scored.provenance,
      semantic: scored.semantic,
      contradiction_penalty: scored.contradiction_penalty,
      contract_penalty: scored.contract_penalty,
      score: scored.score,
    }),
    reasons: explainReasons({
      confidence,
      provenance: provenanceRows,
      contradictions: contradictionRows,
      contracts,
    }),
    provenance: provenanceRows,
    contradictions: contradictionRows,
    inference_path: row.inference_path || [],
    versions: row.versions || [],
    audit_events: publicAuditEvents(row.audit_events || []),
  };
}

export async function deleteDurableMemory(
  db: DurableExecutor,
  input: DurableDeleteInput,
  schema = process.env.OM_PG_SCHEMA || "public",
): Promise<boolean> {
  if (!input.id?.trim()) {
    throw new Error("id is required");
  }

  const memories = table(schema, "memories");
  const auditLog = table(schema, "audit_log");
  const now = (input.now || new Date()).toISOString();
  const actor = auditActor(input.actor_id, input.user_id);
  const params: unknown[] = [input.id, now];
  const userFilter = input.user_id ? " and user_id = $3" : "";
  if (input.user_id) params.push(input.user_id);

  await db.query("BEGIN");
  try {
    const result = (await db.query(
      `update ${memories}
       set superseded_at = $2
       where id = $1 and superseded_at is null${userFilter}
       returning id,user_id,project_id,content,facets,contracts,metadata,recorded_at`,
      params,
    )) as { rows?: any[] };
    const deleted = result.rows?.[0];
    if (!deleted) {
      await db.query("ROLLBACK");
      return false;
    }

    await db.query(
      `insert into ${auditLog}
        (id,user_id,project_id,actor_id,actor_type,event_type,target_table,target_id,operation,before_state,after_state,metadata,recorded_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13)`,
      [
        crypto.randomUUID(),
        deleted.user_id || input.user_id || null,
        deleted.project_id || null,
        actor.id,
        actor.type,
        "memory.delete",
        "memories",
        input.id,
        "soft_delete",
        JSON.stringify(deleted),
        JSON.stringify({ ...deleted, superseded_at: now }),
        JSON.stringify({ reason: input.reason || null }),
        now,
      ],
    );

    await db.query("COMMIT");
    return true;
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  }
}

export async function getDurableMemory(
  db: DurableExecutor,
  input: DurableGetInput,
  schema = process.env.OM_PG_SCHEMA || "public",
): Promise<DurableMemorySummary | null> {
  if (!input.id?.trim()) {
    throw new Error("id is required");
  }

  const memories = table(schema, "memories");
  const provenance = table(schema, "provenance");
  const memoryVersions = table(schema, "memory_versions");
  const params: unknown[] = [input.id];
  const filters = [`m.id = $1`, `m.superseded_at is null`];

  if (input.user_id) {
    params.push(input.user_id);
    filters.push(`m.user_id = $${params.length}`);
  }
  if (input.project_id) {
    params.push(input.project_id);
    filters.push(`(m.project_id = $${params.length} or m.project_id is null)`);
  }

  const result = (await db.query(
    `
      select
        m.id,
        m.user_id,
        m.project_id,
        m.content,
        m.facets,
        m.contracts,
        m.metadata,
        m.salience,
        m.confidence,
        m.valid_from,
        m.valid_to,
        m.observed_at,
        m.recorded_at,
        m.superseded_at,
        coalesce(p.provenance_count, 0) as provenance_count,
        coalesce(v.version_count, 0) as version_count
      from ${memories} m
      left join lateral (
        select count(*)::int as provenance_count
        from ${provenance}
        where memory_id = m.id
      ) p on true
      left join lateral (
        select count(*)::int as version_count
        from ${memoryVersions}
        where memory_id = m.id
      ) v on true
      where ${filters.join("\n        and ")}
      limit 1
    `,
    params,
  )) as { rows?: any[] };

  const row = result.rows?.[0];
  return row ? mapMemorySummary(row) : null;
}

export async function listDurableMemories(
  db: DurableExecutor,
  input: DurableListInput = {},
  schema = process.env.OM_PG_SCHEMA || "public",
): Promise<DurableListResult> {
  const limit = Math.max(1, Math.min(input.limit || 100, 500));
  const offset = Math.max(0, input.offset || 0);
  const memories = table(schema, "memories");
  const provenance = table(schema, "provenance");
  const memoryVersions = table(schema, "memory_versions");
  const params: unknown[] = [limit, offset];
  const filters = [`m.superseded_at is null`];

  if (input.user_id) {
    params.push(input.user_id);
    filters.push(`m.user_id = $${params.length}`);
  }
  if (input.project_id) {
    params.push(input.project_id);
    filters.push(`(m.project_id = $${params.length} or m.project_id is null)`);
  }

  const result = (await db.query(
    `
      select
        m.id,
        m.user_id,
        m.project_id,
        m.content,
        m.facets,
        m.contracts,
        m.metadata,
        m.salience,
        m.confidence,
        m.valid_from,
        m.valid_to,
        m.observed_at,
        m.recorded_at,
        m.superseded_at,
        coalesce(p.provenance_count, 0) as provenance_count,
        coalesce(v.version_count, 0) as version_count
      from ${memories} m
      left join lateral (
        select count(*)::int as provenance_count
        from ${provenance}
        where memory_id = m.id
      ) p on true
      left join lateral (
        select count(*)::int as version_count
        from ${memoryVersions}
        where memory_id = m.id
      ) v on true
      where ${filters.join("\n        and ")}
      order by m.recorded_at desc
      limit $1 offset $2
    `,
    params,
  )) as { rows?: any[] };

  return {
    items: (result.rows || []).map(mapMemorySummary),
    limit,
    offset,
  };
}

export async function updateDurableMemory(
  db: DurableExecutor,
  input: DurableUpdateInput,
  schema = process.env.OM_PG_SCHEMA || "public",
): Promise<DurableUpdateResult | null> {
  if (!input.id?.trim()) {
    throw new Error("id is required");
  }
  if (
    input.content === undefined &&
    input.facets === undefined &&
    input.contracts === undefined &&
    input.metadata === undefined
  ) {
    throw new Error("no update fields provided");
  }

  const memories = table(schema, "memories");
  const memoryVersions = table(schema, "memory_versions");
  const auditLog = table(schema, "audit_log");
  const now = (input.now || new Date()).toISOString();
  const contracts =
    input.contracts === undefined
      ? null
      : JSON.stringify(normalizeDurableContracts(input.contracts));
  const params: unknown[] = [
    input.id,
    input.content ?? null,
    input.facets === undefined ? null : asJson(input.facets),
    contracts,
    input.metadata === undefined ? null : asJson(input.metadata),
    now,
  ];
  const userFilter = input.user_id ? " and user_id = $7" : "";
  if (input.user_id) params.push(input.user_id);

  await db.query("BEGIN");
  try {
    const current = (await db.query(
      `select id,user_id,project_id
       from ${memories}
       where id = $1 and superseded_at is null${userFilter}
       for update`,
      input.user_id ? [input.id, input.user_id] : [input.id],
    )) as { rows?: any[] };
    if (!current.rows?.[0]) {
      await db.query("ROLLBACK");
      return null;
    }

    const versionResult = (await db.query(
      `select coalesce(max(version), 0) as version
       from ${memoryVersions}
       where memory_id = $1`,
      [input.id],
    )) as { rows?: any[] };
    const currentVersion = Number(versionResult.rows?.[0]?.version ?? 0);
    if (
      input.expected_version !== undefined &&
      input.expected_version !== currentVersion
    ) {
      await db.query("ROLLBACK");
      throw new DurableConflictError(input.expected_version, currentVersion);
    }

    const update = (await db.query(
      `update ${memories}
       set
        content = coalesce($2, content),
        facets = coalesce($3::jsonb, facets),
        contracts = coalesce($4::jsonb, contracts),
        metadata = coalesce($5::jsonb, metadata),
        recorded_at = $6
       where id = $1 and superseded_at is null${userFilter}
       returning id,user_id,project_id,content,facets,contracts,metadata,recorded_at`,
      params,
    )) as { rows?: any[] };
    const row = update.rows?.[0];
    if (!row) {
      await db.query("ROLLBACK");
      return null;
    }

    const version = currentVersion + 1;

    await db.query(
      `insert into ${memoryVersions}
        (id,memory_id,version,content,facets,contracts,metadata,recorded_at)
       values ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8)`,
      [
        crypto.randomUUID(),
        input.id,
        version,
        row.content,
        JSON.stringify(row.facets || {}),
        JSON.stringify(row.contracts || {}),
        JSON.stringify(row.metadata || {}),
        now,
      ],
    );

    await db.query(
      `insert into ${auditLog}
        (id,user_id,project_id,event_type,target_table,target_id,operation,before_state,after_state,metadata,recorded_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11)`,
      [
        crypto.randomUUID(),
        row.user_id || input.user_id || null,
        row.project_id || null,
        "memory.update",
        "memories",
        input.id,
        "update",
        null,
        JSON.stringify(row),
        JSON.stringify({ version }),
        now,
      ],
    );

    await db.query("COMMIT");
    return { id: input.id, version, status: "updated" };
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  }
}

export async function reinforceDurableMemory(
  db: DurableExecutor,
  input: DurableReinforceInput,
  schema = process.env.OM_PG_SCHEMA || "public",
): Promise<DurableReinforceResult | null> {
  if (!input.id?.trim()) {
    throw new Error("id is required");
  }

  const memories = table(schema, "memories");
  const auditLog = table(schema, "audit_log");
  const now = (input.now || new Date()).toISOString();
  const salience = bounded(input.boost, 0.1);
  const params: unknown[] = [input.id, salience, now];
  const userFilter = input.user_id ? " and user_id = $4" : "";
  if (input.user_id) params.push(input.user_id);

  await db.query("BEGIN");
  try {
    const result = (await db.query(
      `update ${memories}
       set salience = least(1, salience + $2), recorded_at = $3
       where id = $1 and superseded_at is null${userFilter}
       returning id,user_id,project_id,salience`,
      params,
    )) as { rows?: any[] };
    const row = result.rows?.[0];
    if (!row) {
      await db.query("ROLLBACK");
      return null;
    }

    await db.query(
      `insert into ${auditLog}
        (id,user_id,project_id,event_type,target_table,target_id,operation,before_state,after_state,metadata,recorded_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11)`,
      [
        crypto.randomUUID(),
        row.user_id || input.user_id || null,
        row.project_id || null,
        "memory.reinforce",
        "memories",
        input.id,
        "reinforce",
        null,
        JSON.stringify({ salience: Number(row.salience ?? 0) }),
        JSON.stringify({ boost: salience }),
        now,
      ],
    );

    await db.query("COMMIT");
    return {
      id: input.id,
      salience: Number(row.salience ?? 0),
      status: "reinforced",
    };
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  }
}

const decayLambdaByTier: Record<DurableMemoryTier, number> = {
  active: 0.005,
  warm: 0.02,
  cold: 0.05,
  archived: 0.08,
};

const daysBetween = (later: Date, earlier: unknown) => {
  const parsed =
    earlier instanceof Date
      ? earlier
      : typeof earlier === "string" || typeof earlier === "number"
        ? new Date(earlier)
        : later;
  if (Number.isNaN(parsed.getTime())) return 0;
  return Math.max(0, (later.getTime() - parsed.getTime()) / 86_400_000);
};

const decaySalience = (
  salience: number,
  tier: DurableMemoryTier,
  days: number,
) => {
  const current = bounded(salience, 0.5);
  const lambda = decayLambdaByTier[tier] ?? decayLambdaByTier.active;
  const next = current * Math.exp((-lambda * days) / (current + 0.1));
  return Math.max(0, Math.min(1, Number(next.toFixed(6))));
};

export async function runDurableDecayJob(
  db: DurableExecutor,
  input: DurableDecayJobInput = {},
  schema = process.env.OM_PG_SCHEMA || "public",
): Promise<DurableDecayJobResult> {
  const memories = table(schema, "memories");
  const auditLog = table(schema, "audit_log");
  const now = input.now || new Date();
  const nowIso = now.toISOString();
  const limit = Math.max(1, Math.min(1000, Math.floor(input.limit || 100)));
  const params: unknown[] = [limit];
  const filters = ["superseded_at is null"];

  if (input.user_id) {
    params.push(input.user_id);
    filters.push(`user_id = $${params.length}`);
  }
  if (input.project_id) {
    params.push(input.project_id);
    filters.push(`project_id = $${params.length}`);
  }

  const selected = (await db.query(
    `select id,user_id,project_id,salience,memory_tier,recorded_at,observed_at,valid_from
     from ${memories}
     where ${filters.join(" and ")}
     order by recorded_at asc
     limit $1`,
    params,
  )) as { rows?: any[] };
  const rows = selected.rows || [];
  const changes = rows
    .map((row) => {
      const tier = (row.memory_tier || "active") as DurableMemoryTier;
      const before = Number(row.salience ?? 0.5);
      const age = daysBetween(
        now,
        row.observed_at || row.valid_from || row.recorded_at,
      );
      return {
        row,
        tier,
        before,
        after: decaySalience(before, tier, age),
      };
    })
    .filter((change) => Math.abs(change.before - change.after) >= 0.001);

  if (!input.dry_run && changes.length) {
    await db.query("BEGIN");
    try {
      for (const change of changes) {
        await db.query(
          `update ${memories}
           set salience = $2, recorded_at = $3
           where id = $1 and superseded_at is null
           returning id,user_id,project_id,salience`,
          [change.row.id, change.after, nowIso],
        );
        await db.query(
          `insert into ${auditLog}
            (id,user_id,project_id,event_type,target_table,target_id,operation,before_state,after_state,metadata,recorded_at,actor_id,actor_type)
           values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11,$12,$13)`,
          [
            crypto.randomUUID(),
            change.row.user_id || null,
            change.row.project_id || null,
            "memory.decay",
            "memories",
            change.row.id,
            "decay",
            JSON.stringify({ salience: change.before }),
            JSON.stringify({ salience: change.after }),
            JSON.stringify({ memory_tier: change.tier }),
            nowIso,
            input.actor_id || "system",
            input.actor_id ? "user" : "system",
          ],
        );
      }
      await db.query("COMMIT");
    } catch (err) {
      await db.query("ROLLBACK");
      throw err;
    }
  }

  return {
    scanned: rows.length,
    changed: changes.length,
    dry_run: Boolean(input.dry_run),
    memories: changes.map((change) => ({
      id: change.row.id,
      salience_before: change.before,
      salience_after: change.after,
      memory_tier: change.tier,
    })),
  };
}

export async function resolveDurableContradiction(
  db: DurableExecutor,
  input: DurableResolveContradictionInput,
  schema = process.env.OM_PG_SCHEMA || "public",
): Promise<DurableResolveContradictionResult | null> {
  if (!input.id?.trim()) {
    throw new Error("id is required");
  }
  if (!input.resolution?.trim()) {
    throw new Error("resolution is required");
  }

  const contradictions = table(schema, "contradictions");
  const auditLog = table(schema, "audit_log");
  const now = (input.now || new Date()).toISOString();
  const actorId = input.actor_id?.trim() || null;
  const reason = input.reason?.trim() || null;
  const params: unknown[] = [input.id, input.resolution, now, actorId, reason];
  const userFilter = input.user_id ? " and user_id = $6" : "";
  if (input.user_id) params.push(input.user_id);

  await db.query("BEGIN");
  try {
    const result = (await db.query(
      `update ${contradictions}
       set status = 'resolved',
           resolution = $2,
           resolved_at = $3,
           resolved_by = $4,
           resolution_reason = $5
       where id = $1 and status = 'open'${userFilter}
       returning id,user_id,project_id,status,resolution,resolved_by,resolution_reason`,
      params,
    )) as { rows?: any[] };
    const row = result.rows?.[0];
    if (!row) {
      await db.query("ROLLBACK");
      return null;
    }

    await db.query(
      `insert into ${auditLog}
        (id,user_id,project_id,event_type,target_table,target_id,operation,before_state,after_state,metadata,recorded_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11)`,
      [
        crypto.randomUUID(),
        row.user_id || input.user_id || null,
        row.project_id || null,
        "contradiction.resolve",
        "contradictions",
        input.id,
        "resolve",
        null,
        JSON.stringify(row),
        JSON.stringify({ actor_id: actorId, reason }),
        now,
      ],
    );

    await db.query("COMMIT");
    return {
      id: row.id,
      status: "resolved",
      resolution: row.resolution,
      resolved_by: row.resolved_by ?? null,
      resolution_reason: row.resolution_reason ?? null,
    };
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  }
}

export async function createDurableContradiction(
  db: DurableExecutor,
  input: DurableContradictionInput,
  schema = process.env.OM_PG_SCHEMA || "public",
): Promise<DurableContradictionResult> {
  if (!input.memory_id?.trim()) {
    throw new Error("memory_id is required");
  }
  if (!input.contradicts_memory_id?.trim()) {
    throw new Error("contradicts_memory_id is required");
  }

  const id = input.id || crypto.randomUUID();
  const userId = input.user_id || "anonymous";
  const projectId = input.project_id || null;
  const now = (input.now || new Date()).toISOString();
  const contradictions = table(schema, "contradictions");
  const auditLog = table(schema, "audit_log");
  const conflictGroupId = input.conflict_group_id?.trim() || null;
  const resolutionPolicy = input.resolution_policy?.trim() || "manual";

  await db.query("BEGIN");
  try {
    const result = (await db.query(
      `insert into ${contradictions}
        (id,user_id,project_id,memory_id,contradicts_memory_id,conflict_group_id,resolution_policy,status,confidence,metadata,created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)
       returning id,user_id,project_id,status,conflict_group_id,resolution_policy`,
      [
        id,
        userId,
        projectId,
        input.memory_id,
        input.contradicts_memory_id,
        conflictGroupId,
        resolutionPolicy,
        "open",
        bounded(input.confidence, 1),
        asJson(input.metadata),
        now,
      ],
    )) as { rows?: any[] };
    const row = result.rows?.[0] || {
      id,
      user_id: userId,
      project_id: projectId,
      status: "open",
      conflict_group_id: conflictGroupId,
      resolution_policy: resolutionPolicy,
    };

    await db.query(
      `insert into ${auditLog}
        (id,user_id,project_id,event_type,target_table,target_id,operation,before_state,after_state,metadata,recorded_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11)`,
      [
        crypto.randomUUID(),
        row.user_id || userId,
        row.project_id || projectId,
        "contradiction.create",
        "contradictions",
        id,
        "insert",
        null,
        JSON.stringify({
          id,
          memory_id: input.memory_id,
          contradicts_memory_id: input.contradicts_memory_id,
          conflict_group_id: conflictGroupId,
          resolution_policy: resolutionPolicy,
          status: "open",
          confidence: bounded(input.confidence, 1),
        }),
        asJson(input.metadata),
        now,
      ],
    );

    await db.query("COMMIT");
    return {
      id: row.id,
      status: "open",
      conflict_group_id: row.conflict_group_id ?? null,
      resolution_policy: row.resolution_policy || "manual",
    };
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  }
}

export async function createDurableConsolidation(
  db: DurableExecutor,
  input: DurableConsolidationInput = {},
  schema = process.env.OM_PG_SCHEMA || "public",
): Promise<DurableConsolidationResult> {
  const id = input.id || crypto.randomUUID();
  const userId = input.user_id || "anonymous";
  const projectId = input.project_id || null;
  const idempotencyKey = input.idempotency_key?.trim() || null;
  const now = (input.now || new Date()).toISOString();
  const consolidations = table(schema, "consolidations");
  const auditLog = table(schema, "audit_log");

  await db.query("BEGIN");
  try {
    if (idempotencyKey) {
      const existing = (await db.query(
        `select id,status
         from ${consolidations}
         where user_id = $1
           and ((project_id = $2) or (project_id is null and $2 is null))
           and idempotency_key = $3
         limit 1`,
        [userId, projectId, idempotencyKey],
      )) as { rows?: any[] };
      const row = existing.rows?.[0];
      if (row) {
        await db.query("COMMIT");
        return { id: row.id, status: "pending" };
      }
    }

    const result = (await db.query(
      `insert into ${consolidations}
        (id,user_id,project_id,idempotency_key,scope,source_memory_ids,status,metadata,created_at)
       values ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8::jsonb,$9)
       returning id,status`,
      [
        id,
        userId,
        projectId,
        idempotencyKey,
        asJson(input.scope),
        JSON.stringify(input.source_memory_ids || []),
        "pending",
        asJson(input.metadata),
        now,
      ],
    )) as { rows?: any[] };
    const row = result.rows?.[0] || { id, status: "pending" };

    await db.query(
      `insert into ${auditLog}
        (id,user_id,project_id,event_type,target_table,target_id,operation,before_state,after_state,metadata,recorded_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11)`,
      [
        crypto.randomUUID(),
        userId,
        projectId,
        "consolidation.request",
        "consolidations",
        id,
        "insert",
        null,
        JSON.stringify({
          id,
          user_id: userId,
          project_id: projectId,
          idempotency_key: idempotencyKey,
          scope: input.scope || {},
          source_memory_ids: input.source_memory_ids || [],
          status: "pending",
        }),
        asJson(input.metadata),
        now,
      ],
    );

    await db.query("COMMIT");
    return { id: row.id, status: "pending" };
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  }
}

export async function claimDurableConsolidation(
  db: DurableExecutor,
  input: DurableConsolidationClaimInput,
  schema = process.env.OM_PG_SCHEMA || "public",
): Promise<DurableConsolidationJob | null> {
  if (!input.worker_id?.trim()) {
    throw new Error("worker_id is required");
  }

  const consolidations = table(schema, "consolidations");
  const auditLog = table(schema, "audit_log");
  const now = (input.now || new Date()).toISOString();
  const filters = ["status = 'pending'"];
  const params: unknown[] = [input.worker_id, now];
  if (input.user_id) {
    params.push(input.user_id);
    filters.push(`user_id = $${params.length}`);
  }
  if (input.project_id) {
    params.push(input.project_id);
    filters.push(`project_id = $${params.length}`);
  }

  await db.query("BEGIN");
  try {
    const result = (await db.query(
      `update ${consolidations}
       set status = 'running', worker_id = $1, started_at = $2
       where id = (
         select id
         from ${consolidations}
         where ${filters.join(" and ")}
         order by created_at asc
         for update skip locked
         limit 1
       )
       returning id,user_id,project_id,scope,source_memory_ids,status,worker_id`,
      params,
    )) as { rows?: any[] };
    const row = result.rows?.[0];
    if (!row) {
      await db.query("ROLLBACK");
      return null;
    }

    await db.query(
      `insert into ${auditLog}
        (id,user_id,project_id,event_type,target_table,target_id,operation,before_state,after_state,metadata,recorded_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11)`,
      [
        crypto.randomUUID(),
        row.user_id || null,
        row.project_id || null,
        "consolidation.claim",
        "consolidations",
        row.id,
        "update",
        null,
        JSON.stringify(row),
        JSON.stringify({ worker_id: input.worker_id }),
        now,
      ],
    );

    await db.query("COMMIT");
    return {
      id: row.id,
      user_id: row.user_id,
      project_id: row.project_id ?? null,
      scope: row.scope || {},
      source_memory_ids: Array.isArray(row.source_memory_ids)
        ? row.source_memory_ids
        : [],
      status: "running",
      worker_id: row.worker_id || input.worker_id,
    };
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  }
}

export async function completeDurableConsolidation(
  db: DurableExecutor,
  input: DurableConsolidationCompleteInput,
  schema = process.env.OM_PG_SCHEMA || "public",
): Promise<DurableConsolidationCompleteResult | null> {
  if (!input.id?.trim()) {
    throw new Error("id is required");
  }
  if (!input.result_memory_id?.trim()) {
    throw new Error("result_memory_id is required");
  }

  const consolidations = table(schema, "consolidations");
  const consolidationResults = table(schema, "consolidation_results");
  const auditLog = table(schema, "audit_log");
  const resultId = crypto.randomUUID();
  const now = (input.now || new Date()).toISOString();
  const sourceMemoryIds = input.source_memory_ids || [];

  await db.query("BEGIN");
  try {
    const result = (await db.query(
      `insert into ${consolidationResults}
        (id,consolidation_id,result_memory_id,source_memory_ids,summary,metadata,created_at)
       values ($1,$2,$3,$4::jsonb,$5,$6::jsonb,$7)
       returning id`,
      [
        resultId,
        input.id,
        input.result_memory_id,
        JSON.stringify(sourceMemoryIds),
        input.summary || null,
        asJson(input.metadata),
        now,
      ],
    )) as { rows?: any[] };
    const row = result.rows?.[0] || { id: resultId };

    const completed = (await db.query(
      `update ${consolidations}
       set status = 'completed', result_memory_id = $2, completed_at = $3
       where id = $1 and status = 'running'
       returning id,user_id,project_id,status,result_memory_id`,
      [input.id, input.result_memory_id, now],
    )) as { rows?: any[] };
    const consolidation = completed.rows?.[0];
    if (!consolidation) {
      await db.query("ROLLBACK");
      return null;
    }

    await db.query(
      `insert into ${auditLog}
        (id,user_id,project_id,event_type,target_table,target_id,operation,before_state,after_state,metadata,recorded_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11)`,
      [
        crypto.randomUUID(),
        consolidation.user_id || null,
        consolidation.project_id || null,
        "consolidation.complete",
        "consolidations",
        input.id,
        "update",
        null,
        JSON.stringify({
          id: input.id,
          status: "completed",
          result_id: row.id,
          result_memory_id: input.result_memory_id,
          source_memory_ids: sourceMemoryIds,
        }),
        asJson(input.metadata),
        now,
      ],
    );

    await db.query("COMMIT");
    return {
      id: input.id,
      status: "completed",
      result_id: row.id,
      result_memory_id:
        consolidation.result_memory_id || input.result_memory_id,
    };
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  }
}

export function evaluateConsolidationRecallImpact(
  input: ConsolidationRecallEvalInput,
): ConsolidationRecallEvalResult {
  const minRecallGain = input.min_recall_gain ?? 0;
  const maxNoiseIncrease = input.max_noise_increase ?? 0;
  const recallGain = input.candidate.recall_score - input.baseline.recall_score;
  const noiseDelta = input.candidate.noise_score - input.baseline.noise_score;
  return {
    passed: recallGain >= minRecallGain && noiseDelta <= maxNoiseIncrease,
    recall_gain: recallGain,
    noise_delta: noiseDelta,
  };
}

export async function createWorkingMemoryEvent(
  db: DurableExecutor,
  input: WorkingMemoryEventInput,
  schema = process.env.OM_PG_SCHEMA || "public",
): Promise<WorkingMemoryEventResult> {
  if (!input.source?.kind?.trim()) {
    throw new Error("source kind is required");
  }
  const content =
    typeof input.content === "string"
      ? input.content
      : input.content.toString("utf8");
  if (!content.trim()) {
    throw new Error("content is required");
  }

  const id = input.id || crypto.randomUUID();
  const userId = input.user_id || "anonymous";
  const projectId = input.project_id || null;
  const now = input.now || new Date();
  const observedAt = isoOrNull(input.observed_at) || now.toISOString();
  const recordedAt = now.toISOString();
  const workingMemoryEvents = table(schema, "working_memory_events");
  const auditLog = table(schema, "audit_log");
  const contracts = normalizeDurableContracts(input.contracts);
  const metadata = enrichDurableMetadata(content, input.metadata);

  await db.query("BEGIN");
  try {
    const result = (await db.query(
      `insert into ${workingMemoryEvents}
        (id,user_id,project_id,source,content,metadata,contracts,status,observed_at,recorded_at)
       values ($1,$2,$3,$4::jsonb,$5,$6::jsonb,$7::jsonb,$8,$9,$10)
       returning id,status`,
      [
        id,
        userId,
        projectId,
        JSON.stringify(input.source),
        content,
        JSON.stringify(metadata),
        JSON.stringify(contracts),
        "pending",
        observedAt,
        recordedAt,
      ],
    )) as { rows?: any[] };
    const row = result.rows?.[0] || { id, status: "pending" };

    await db.query(
      `insert into ${auditLog}
        (id,user_id,project_id,event_type,target_table,target_id,operation,before_state,after_state,metadata,recorded_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11)`,
      [
        crypto.randomUUID(),
        userId,
        projectId,
        "ingestion.event",
        "working_memory_events",
        id,
        "insert",
        null,
        JSON.stringify({
          id,
          user_id: userId,
          project_id: projectId,
          source: input.source,
          status: "pending",
          observed_at: observedAt,
        }),
        JSON.stringify(metadata),
        recordedAt,
      ],
    );

    await db.query("COMMIT");
    return {
      id: row.id,
      status: "pending",
      extraction: {
        automatic: false,
        status: "disabled",
      },
    };
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  }
}

export async function createExtractionCandidate(
  db: DurableExecutor,
  input: ExtractionCandidateInput,
  schema = process.env.OM_PG_SCHEMA || "public",
): Promise<ExtractionCandidateResult> {
  if (!input.event_id?.trim()) {
    throw new Error("event_id is required");
  }
  if (!input.content?.trim()) {
    throw new Error("content is required");
  }

  const id = input.id || crypto.randomUUID();
  const userId = input.user_id || "anonymous";
  const projectId = input.project_id || null;
  const now = (input.now || new Date()).toISOString();
  const extractionCandidates = table(schema, "extraction_candidates");
  const auditLog = table(schema, "audit_log");
  const contracts = normalizeDurableContracts(input.contracts);
  const metadata = enrichDurableMetadata(input.content, input.metadata);

  await db.query("BEGIN");
  try {
    const result = (await db.query(
      `insert into ${extractionCandidates}
        (id,event_id,user_id,project_id,content,facets,entities,edges,contradictions,contracts,confidence,status,metadata,created_at)
       values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11,$12,$13::jsonb,$14)
       returning id,status`,
      [
        id,
        input.event_id,
        userId,
        projectId,
        input.content,
        asJson(input.facets),
        JSON.stringify(input.entities || []),
        JSON.stringify(input.edges || []),
        JSON.stringify(input.contradictions || []),
        JSON.stringify(contracts),
        bounded(input.confidence, 0.5),
        "pending",
        JSON.stringify(metadata),
        now,
      ],
    )) as { rows?: any[] };
    const row = result.rows?.[0] || { id, status: "pending" };

    await db.query(
      `insert into ${auditLog}
        (id,user_id,project_id,event_type,target_table,target_id,operation,before_state,after_state,metadata,recorded_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11)`,
      [
        crypto.randomUUID(),
        userId,
        projectId,
        "ingestion.candidate",
        "extraction_candidates",
        id,
        "insert",
        null,
        JSON.stringify({
          id,
          event_id: input.event_id,
          user_id: userId,
          project_id: projectId,
          status: "pending",
          confidence: bounded(input.confidence, 0.5),
        }),
        JSON.stringify(metadata),
        now,
      ],
    );

    await db.query("COMMIT");
    return { id: row.id, status: "pending" };
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  }
}

export async function promoteExtractionCandidate(
  db: DurableExecutor,
  input: PromoteExtractionCandidateInput,
  schema = process.env.OM_PG_SCHEMA || "public",
): Promise<PromoteExtractionCandidateResult | null> {
  if (!input.candidate_id?.trim()) {
    throw new Error("candidate_id is required");
  }

  const memories = table(schema, "memories");
  const memoryVersions = table(schema, "memory_versions");
  const provenance = table(schema, "provenance");
  const contradictions = table(schema, "contradictions");
  const entities = table(schema, "entities");
  const memoryEntities = table(schema, "memory_entities");
  const edges = table(schema, "edges");
  const extractionCandidates = table(schema, "extraction_candidates");
  const auditLog = table(schema, "audit_log");
  const memoryId = input.memory_id || crypto.randomUUID();
  const now = input.now || new Date();
  const recordedAt = now.toISOString();

  await db.query("BEGIN");
  try {
    const candidateResult = (await db.query(
      `select id,event_id,user_id,project_id,content,facets,entities,edges,contradictions,contracts,confidence,metadata
       from ${extractionCandidates}
       where id = $1 and status = 'pending'
       limit 1`,
      [input.candidate_id],
    )) as { rows?: any[] };
    const candidate = candidateResult.rows?.[0];
    if (!candidate) {
      await db.query("ROLLBACK");
      return null;
    }

    const candidateEntities = Array.isArray(candidate.entities)
      ? candidate.entities
      : [];
    const candidateEdges = Array.isArray(candidate.edges)
      ? candidate.edges
      : [];
    const candidateContradictions = Array.isArray(candidate.contradictions)
      ? candidate.contradictions
      : [];
    const contracts = normalizeDurableContracts(candidate.contracts || {});
    const candidateMetadata = enrichDurableMetadata(
      candidate.content,
      candidate.metadata || {},
    );
    const source: DurableSource = input.source || {
      kind: "ingestion",
      id: candidate.event_id,
    };

    await db.query(
      `insert into ${memories}
        (id,user_id,project_id,content,facets,contracts,metadata,confidence,observed_at,recorded_at)
       values ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9,$10)`,
      [
        memoryId,
        candidate.user_id || "anonymous",
        candidate.project_id || null,
        candidate.content,
        JSON.stringify(candidate.facets || {}),
        JSON.stringify(contracts),
        JSON.stringify(candidateMetadata),
        bounded(Number(candidate.confidence), 0.5),
        sourceObservedAt(source, now).toISOString(),
        recordedAt,
      ],
    );

    await db.query(
      `insert into ${memoryVersions}
        (id,memory_id,version,content,facets,contracts,metadata,recorded_at)
       values ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8)`,
      [
        crypto.randomUUID(),
        memoryId,
        1,
        candidate.content,
        JSON.stringify(candidate.facets || {}),
        JSON.stringify(contracts),
        JSON.stringify(candidateMetadata),
        recordedAt,
      ],
    );

    await db.query(
      `insert into ${provenance}
        (id,memory_id,source_kind,source_uri,source_id,extraction_method,trust_score,observed_at,metadata,recorded_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)`,
      [
        crypto.randomUUID(),
        memoryId,
        source.kind || "ingestion",
        source.uri || null,
        source.id || candidate.event_id,
        "durable_ingestion",
        0.5,
        sourceObservedAt(source, now).toISOString(),
        JSON.stringify({
          candidate_id: candidate.id,
          event_id: candidate.event_id,
        }),
        recordedAt,
      ],
    );

    for (const entity of candidateEntities) {
      if (!entity?.name?.trim()) continue;
      const entityId = entity.id || crypto.randomUUID();
      await db.query(
        `insert into ${entities}
          (id,user_id,project_id,entity_type,canonical_name,aliases,metadata,created_at,updated_at)
         values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9)
         on conflict(id) do update set
          user_id=excluded.user_id,
          project_id=excluded.project_id,
          entity_type=excluded.entity_type,
          canonical_name=excluded.canonical_name,
          aliases=excluded.aliases,
          metadata=excluded.metadata,
          updated_at=excluded.updated_at`,
        [
          entityId,
          candidate.user_id || "anonymous",
          candidate.project_id || null,
          entity.type || "unknown",
          entity.name.trim(),
          JSON.stringify(entity.aliases || []),
          asJson(entity.metadata),
          recordedAt,
          recordedAt,
        ],
      );
      await db.query(
        `insert into ${memoryEntities}
          (memory_id,entity_id,role,confidence)
         values ($1,$2,$3,$4)
         on conflict(memory_id, entity_id) do update set
          role=excluded.role,
          confidence=excluded.confidence`,
        [
          memoryId,
          entityId,
          entity.role || null,
          bounded(entity.confidence, 1),
        ],
      );
    }

    for (const edge of candidateEdges) {
      if (!edge?.type?.trim()) continue;
      await db.query(
        `insert into ${edges}
          (id,user_id,project_id,source_memory_id,target_memory_id,source_entity_id,target_entity_id,edge_type,weight,confidence,provenance,metadata,valid_from,valid_to,recorded_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13,$14,$15)`,
        [
          edge.id || crypto.randomUUID(),
          candidate.user_id || "anonymous",
          candidate.project_id || null,
          memoryId,
          edge.target_memory_id || null,
          edge.source_entity_id || null,
          edge.target_entity_id || null,
          allowedEdgeType(edge.type),
          bounded(edge.weight, 1),
          bounded(edge.confidence, 1),
          asJson(edge.provenance),
          asJson(edge.metadata),
          isoOrNull(edge.valid_from),
          isoOrNull(edge.valid_to),
          recordedAt,
        ],
      );
    }

    for (const contradiction of candidateContradictions) {
      if (!contradiction?.contradicts_memory_id?.trim()) continue;
      const contradictionId = contradiction.id || crypto.randomUUID();
      const conflictGroupId = contradiction.conflict_group_id?.trim() || null;
      const resolutionPolicy =
        contradiction.resolution_policy?.trim() || "manual";
      await db.query(
        `insert into ${contradictions}
          (id,user_id,project_id,memory_id,contradicts_memory_id,conflict_group_id,resolution_policy,status,confidence,metadata,created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)`,
        [
          contradictionId,
          candidate.user_id || "anonymous",
          candidate.project_id || null,
          memoryId,
          contradiction.contradicts_memory_id,
          conflictGroupId,
          resolutionPolicy,
          "open",
          bounded(contradiction.confidence, 1),
          asJson(contradiction.metadata),
          recordedAt,
        ],
      );
      await db.query(
        `insert into ${auditLog}
          (id,user_id,project_id,event_type,target_table,target_id,operation,before_state,after_state,metadata,recorded_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11)`,
        [
          crypto.randomUUID(),
          candidate.user_id || null,
          candidate.project_id || null,
          "contradiction.create",
          "contradictions",
          contradictionId,
          "insert",
          null,
          JSON.stringify({
            id: contradictionId,
            memory_id: memoryId,
            contradicts_memory_id: contradiction.contradicts_memory_id,
            conflict_group_id: conflictGroupId,
            resolution_policy: resolutionPolicy,
            status: "open",
            confidence: bounded(contradiction.confidence, 1),
          }),
          asJson(contradiction.metadata),
          recordedAt,
        ],
      );
    }

    await db.query(
      `update ${extractionCandidates}
       set status = 'accepted'
       where id = $1`,
      [input.candidate_id],
    );

    await db.query(
      `insert into ${auditLog}
        (id,user_id,project_id,event_type,target_table,target_id,operation,before_state,after_state,metadata,recorded_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11)`,
      [
        crypto.randomUUID(),
        candidate.user_id || null,
        candidate.project_id || null,
        "ingestion.promote",
        "memories",
        memoryId,
        "insert",
        null,
        JSON.stringify({
          id: memoryId,
          candidate_id: input.candidate_id,
          event_id: candidate.event_id,
          status: "stored",
        }),
        JSON.stringify({ candidate_id: input.candidate_id }),
        recordedAt,
      ],
    );

    await db.query("COMMIT");
    return {
      id: memoryId,
      candidate_id: input.candidate_id,
      status: "stored",
    };
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  }
}

export async function rejectExtractionCandidate(
  db: DurableExecutor,
  input: RejectExtractionCandidateInput,
  schema = process.env.OM_PG_SCHEMA || "public",
): Promise<RejectExtractionCandidateResult | null> {
  if (!input.candidate_id?.trim()) {
    throw new Error("candidate_id is required");
  }
  if (!input.reason?.trim()) {
    throw new Error("reason is required");
  }

  const extractionCandidates = table(schema, "extraction_candidates");
  const auditLog = table(schema, "audit_log");
  const now = (input.now || new Date()).toISOString();
  const params: unknown[] = [input.candidate_id, input.reason, now];
  const userFilter = input.user_id ? " and user_id = $4" : "";
  if (input.user_id) params.push(input.user_id);

  await db.query("BEGIN");
  try {
    const result = (await db.query(
      `update ${extractionCandidates}
       set status = 'rejected', rejection_reason = $2
       where id = $1 and status = 'pending'${userFilter}
       returning id,event_id,user_id,project_id,status,rejection_reason`,
      params,
    )) as { rows?: any[] };
    const row = result.rows?.[0];
    if (!row) {
      await db.query("ROLLBACK");
      return null;
    }

    await db.query(
      `insert into ${auditLog}
        (id,user_id,project_id,event_type,target_table,target_id,operation,before_state,after_state,metadata,recorded_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11)`,
      [
        crypto.randomUUID(),
        row.user_id || input.user_id || null,
        row.project_id || null,
        "ingestion.reject",
        "extraction_candidates",
        input.candidate_id,
        "reject",
        null,
        JSON.stringify({
          id: row.id,
          event_id: row.event_id,
          status: "rejected",
          rejection_reason: row.rejection_reason,
        }),
        JSON.stringify({ reason: input.reason }),
        now,
      ],
    );

    await db.query("COMMIT");
    return {
      id: row.id,
      status: "rejected",
      reason: row.rejection_reason || input.reason,
    };
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  }
}
