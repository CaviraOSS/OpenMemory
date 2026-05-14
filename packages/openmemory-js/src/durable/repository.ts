import crypto from "node:crypto";

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
  type: string;
  target_memory_id?: string;
  source_entity_id?: string;
  target_entity_id?: string;
  weight?: number;
  metadata?: Record<string, unknown>;
  valid_from?: string | Date;
  valid_to?: string | Date;
}

export interface DurableRememberInput {
  id?: string;
  content: string;
  user_id?: string;
  project_id?: string;
  facets?: Record<string, unknown>;
  contracts?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  entities?: DurableEntityInput[];
  edges?: DurableEdgeInput[];
  source?: DurableSource;
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
    provenance: unknown[];
    contradictions: unknown[];
  }>;
}

export interface DurableExplainInput {
  id: string;
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
  provenance: unknown[];
  contradictions: unknown[];
  inference_path: unknown[];
  versions: unknown[];
  audit_events: unknown[];
}

export interface DurableDeleteInput {
  id: string;
  user_id?: string;
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

export interface DurableResolveContradictionInput {
  id: string;
  resolution: string;
  user_id?: string;
  now?: Date;
}

export interface DurableResolveContradictionResult {
  id: string;
  status: "resolved";
  resolution: string;
}

export interface DurableConsolidationInput {
  id?: string;
  user_id?: string;
  project_id?: string;
  scope?: Record<string, unknown>;
  source_memory_ids?: string[];
  metadata?: Record<string, unknown>;
  now?: Date;
}

export interface DurableConsolidationResult {
  id: string;
  status: "pending";
}

const ident = (name: string) => `"${name.replace(/"/g, '""')}"`;
const table = (schema: string, name: string) => `${ident(schema)}.${ident(name)}`;

const asJson = (value: unknown) => JSON.stringify(value ?? {});

const sourceObservedAt = (source: DurableSource | undefined, fallback: Date) => {
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

const bounded = (value: number | undefined, fallback: number) => {
  if (value === undefined || Number.isNaN(value)) return fallback;
  return Math.max(0, Math.min(value, 1));
};

const isoOrNull = (value: string | Date | undefined) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
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

  const memoryState = {
    id,
    user_id: userId,
    project_id: input.project_id || null,
    content: input.content,
    facets: input.facets || {},
    contracts: input.contracts || {},
    metadata: input.metadata || {},
    observed_at: sourceObservedAt(input.source, now).toISOString(),
    recorded_at: now.toISOString(),
  };

  await db.query("BEGIN");
  try {
    await db.query(
      `insert into ${memories}
        (id,user_id,project_id,content,facets,contracts,metadata,observed_at,recorded_at)
       values ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9)`,
      [
        id,
        userId,
        input.project_id || null,
        input.content,
        asJson(input.facets),
        asJson(input.contracts),
        asJson(input.metadata),
        memoryState.observed_at,
        memoryState.recorded_at,
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
        asJson(input.contracts),
        asJson(input.metadata),
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
        [
          id,
          entityId,
          entity.role || null,
          bounded(entity.confidence, 1),
        ],
      );
    }

    for (const edge of input.edges || []) {
      if (!edge.type?.trim()) continue;
      await db.query(
        `insert into ${edges}
          (id,user_id,project_id,source_memory_id,target_memory_id,source_entity_id,target_entity_id,edge_type,weight,metadata,valid_from,valid_to,recorded_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13)`,
        [
          edge.id || crypto.randomUUID(),
          userId,
          input.project_id || null,
          id,
          edge.target_memory_id || null,
          edge.source_entity_id || null,
          edge.target_entity_id || null,
          edge.type,
          bounded(edge.weight, 1),
          asJson(edge.metadata),
          isoOrNull(edge.valid_from),
          isoOrNull(edge.valid_to),
          memoryState.recorded_at,
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
        input.project_id || null,
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
  const atTime = recallTime(input.at_time).toISOString();
  const limit = Math.max(1, Math.min(input.limit || 10, 100));
  const memories = table(schema, "memories");
  const provenance = table(schema, "provenance");
  const contradictions = table(schema, "contradictions");
  const params: unknown[] = [`%${input.query}%`, atTime, limit];
  const filters = [
    `m.content ilike $1`,
    `(m.valid_from is null or m.valid_from <= $2)`,
    `(m.valid_to is null or m.valid_to > $2)`,
    `m.recorded_at <= $2`,
    `m.superseded_at is null`,
  ];

  if (input.user_id) {
    params.push(input.user_id);
    filters.push(`m.user_id = $${params.length}`);
  }

  if (input.project_id) {
    params.push(input.project_id);
    filters.push(`(m.project_id = $${params.length} or m.project_id is null)`);
  }

  if (mode === "strict") {
    filters.push(`jsonb_array_length(coalesce(p.provenance, '[]'::jsonb)) > 0`);
    filters.push(`jsonb_array_length(coalesce(c.contradictions, '[]'::jsonb)) = 0`);
    filters.push(`coalesce(m.contracts->>'recall_allowed', 'true') <> 'false'`);
  }

  const order =
    mode === "historical"
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
        'id', id,
        'contradicts_memory_id', contradicts_memory_id,
        'status', status,
        'confidence', confidence
      )) as contradictions
      from ${contradictions}
      where memory_id = m.id and status = 'open'
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
    results: rows.map((row) => ({
      id: row.id,
      content: row.content,
      score: Number(row.confidence ?? 0) * 0.6 + Number(row.salience ?? 0) * 0.4,
      facets: row.facets || {},
      contracts: row.contracts || {},
      metadata: row.metadata || {},
      salience: Number(row.salience ?? 0),
      confidence: Number(row.confidence ?? 0),
      recorded_at: row.recorded_at ?? null,
      valid_from: row.valid_from ?? null,
      valid_to: row.valid_to ?? null,
      provenance: row.provenance || [],
      contradictions: row.contradictions || [],
    })),
  };
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
  const provenanceRows = row.provenance || [];
  const contradictionRows = row.contradictions || [];

  return {
    id: row.id,
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
    score_components: {
      confidence: Number(row.confidence ?? 0),
      salience: Number(row.salience ?? 0),
      provenance: provenanceRows.length > 0 ? 1 : 0,
      contradiction_penalty: contradictionRows.length > 0 ? 1 : 0,
      contract_penalty: contracts.recall_allowed === false ? 1 : 0,
      contracts,
    },
    provenance: provenanceRows,
    contradictions: contradictionRows,
    inference_path: row.inference_path || [],
    versions: row.versions || [],
    audit_events: row.audit_events || [],
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
        (id,user_id,project_id,event_type,target_table,target_id,operation,before_state,after_state,metadata,recorded_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11)`,
      [
        crypto.randomUUID(),
        deleted.user_id || input.user_id || null,
        deleted.project_id || null,
        "memory.delete",
        "memories",
        input.id,
        "soft_delete",
        JSON.stringify(deleted),
        JSON.stringify({ ...deleted, superseded_at: now }),
        "{}",
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
  const params: unknown[] = [
    input.id,
    input.content ?? null,
    input.facets === undefined ? null : asJson(input.facets),
    input.contracts === undefined ? null : asJson(input.contracts),
    input.metadata === undefined ? null : asJson(input.metadata),
    now,
  ];
  const userFilter = input.user_id ? " and user_id = $7" : "";
  if (input.user_id) params.push(input.user_id);

  await db.query("BEGIN");
  try {
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

    const versionResult = (await db.query(
      `select coalesce(max(version), 0) as version
       from ${memoryVersions}
       where memory_id = $1`,
      [input.id],
    )) as { rows?: any[] };
    const version = Number(versionResult.rows?.[0]?.version ?? 0) + 1;

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
  const params: unknown[] = [input.id, input.resolution, now];
  const userFilter = input.user_id ? " and user_id = $4" : "";
  if (input.user_id) params.push(input.user_id);

  await db.query("BEGIN");
  try {
    const result = (await db.query(
      `update ${contradictions}
       set status = 'resolved', resolution = $2, resolved_at = $3
       where id = $1 and status = 'open'${userFilter}
       returning id,user_id,project_id,status,resolution`,
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
        JSON.stringify({ resolution: input.resolution }),
        now,
      ],
    );

    await db.query("COMMIT");
    return {
      id: row.id,
      status: "resolved",
      resolution: row.resolution,
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
  const now = (input.now || new Date()).toISOString();
  const consolidations = table(schema, "consolidations");
  const auditLog = table(schema, "audit_log");

  await db.query("BEGIN");
  try {
    const result = (await db.query(
      `insert into ${consolidations}
        (id,user_id,project_id,scope,source_memory_ids,status,metadata,created_at)
       values ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7::jsonb,$8)
       returning id,status`,
      [
        id,
        userId,
        projectId,
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
