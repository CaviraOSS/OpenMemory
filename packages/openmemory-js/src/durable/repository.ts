import crypto from "node:crypto";

export interface DurableExecutor {
  query(sql: string, params?: unknown[]): Promise<unknown>;
}

export interface DurableSource {
  kind?: string;
  uri?: string;
  id?: string;
  observed_at?: string | Date;
}

export interface DurableRememberInput {
  id?: string;
  content: string;
  user_id?: string;
  project_id?: string;
  facets?: Record<string, unknown>;
  contracts?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  source?: DurableSource;
  now?: Date;
}

export interface DurableRememberResult {
  id: string;
  status: "stored";
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
