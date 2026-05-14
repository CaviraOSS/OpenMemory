import { Pool } from "pg";
import { buildDurableSchemaSql } from "../../src/durable/schema";

type HttpJson = {
  status: number;
  body: any;
};

const randomPort = () => 43000 + Math.floor(Math.random() * 10000);

const parseConnectionEnv = (connectionString: string) => {
  const url = new URL(connectionString);
  process.env.OM_METADATA_BACKEND = "postgres";
  process.env.OM_VECTOR_BACKEND = "postgres";
  process.env.OM_EMBEDDINGS = "synthetic";
  process.env.OM_TIER = "hybrid";
  process.env.OM_PG_HOST = url.hostname;
  process.env.OM_PG_PORT = url.port || "5432";
  process.env.OM_PG_DB = url.pathname.replace(/^\//, "");
  process.env.OM_PG_USER = decodeURIComponent(url.username);
  process.env.OM_PG_PASSWORD = decodeURIComponent(url.password);
  process.env.OM_PG_SSL =
    url.searchParams.get("sslmode") === "require" ? "require" : "disable";
};

const postJson = async (baseUrl: string, path: string, body: unknown) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() } as HttpJson;
};

const patchJson = async (baseUrl: string, path: string, body: unknown) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() } as HttpJson;
};

const getJson = async (baseUrl: string, path: string) => {
  const response = await fetch(`${baseUrl}${path}`);
  return { status: response.status, body: await response.json() } as HttpJson;
};

const assertOk = (result: HttpJson, label: string) => {
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`${label} failed: ${result.status} ${JSON.stringify(result.body)}`);
  }
};

export async function runPostgresV1Integration(connectionString: string) {
  parseConnectionEnv(connectionString);
  const schema = `om_v1_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const port = randomPort();
  process.env.OM_PG_SCHEMA = schema;
  process.env.OM_PORT = String(port);

  const pool = new Pool({
    connectionString,
    ssl:
      process.env.OM_PG_SSL === "require"
        ? { rejectUnauthorized: false }
        : undefined,
  });

  try {
    for (const sql of buildDurableSchemaSql({ schema, vectorDim: 1536 })) {
      await pool.query(sql);
    }

    const { createApp } = await import("../../src/api/index");
    const app = createApp();
    await new Promise<void>((resolve) => app.listen(port, resolve));
    const baseUrl = `http://127.0.0.1:${port}`;

    const remember = await postJson(baseUrl, "/v1/memories", {
      content: "Ada Lovelace wrote durable integration notes",
      user_id: "pg_user",
      project_id: "pg_project",
      source: { kind: "test", id: "postgres-v1" },
      entities: [{ type: "person", name: "Ada Lovelace", role: "subject" }],
      edges: [{ type: "mentions", weight: 0.8 }],
    });
    assertOk(remember, "remember");
    if (remember.body.adapter !== "durable-postgres") {
      throw new Error(`remember used ${remember.body.adapter}`);
    }

    const getMemory = await getJson(
      baseUrl,
      `/v1/memories/${remember.body.id}?user_id=pg_user&project_id=pg_project`,
    );
    assertOk(getMemory, "get memory");
    if (
      getMemory.body.adapter !== "durable-postgres" ||
      getMemory.body.version_count !== 1 ||
      getMemory.body.provenance_count !== 1
    ) {
      throw new Error(`get did not return durable summary: ${JSON.stringify(getMemory.body)}`);
    }

    const listMemory = await getJson(
      baseUrl,
      "/v1/memories?user_id=pg_user&project_id=pg_project&limit=10&offset=0",
    );
    assertOk(listMemory, "list memories");
    if (
      listMemory.body.adapter !== "durable-postgres" ||
      listMemory.body.items.length !== 1
    ) {
      throw new Error(`list did not return durable memory: ${JSON.stringify(listMemory.body)}`);
    }

    const update = await patchJson(baseUrl, `/v1/memories/${remember.body.id}`, {
      user_id: "pg_user",
      content: "Ada Lovelace wrote updated durable integration notes",
      metadata: { updated: true },
    });
    assertOk(update, "update memory");
    if (update.body.adapter !== "durable-postgres" || update.body.version !== 2) {
      throw new Error(`update did not append version: ${JSON.stringify(update.body)}`);
    }

    const reinforce = await postJson(
      baseUrl,
      `/v1/memories/${remember.body.id}/reinforce`,
      { user_id: "pg_user", boost: 0.2 },
    );
    assertOk(reinforce, "reinforce memory");
    if (
      reinforce.body.adapter !== "durable-postgres" ||
      reinforce.body.status !== "reinforced"
    ) {
      throw new Error(`reinforce failed: ${JSON.stringify(reinforce.body)}`);
    }

    const consolidation = await postJson(baseUrl, "/v1/consolidations", {
      user_id: "pg_user",
      project_id: "pg_project",
      scope: { type: "project", project_id: "pg_project" },
      source_memory_ids: [remember.body.id],
      metadata: { reason: "integration" },
    });
    assertOk(consolidation, "consolidation");
    if (
      consolidation.body.adapter !== "durable-postgres" ||
      consolidation.body.status !== "pending"
    ) {
      throw new Error(`consolidation failed: ${JSON.stringify(consolidation.body)}`);
    }

    const recall = await postJson(baseUrl, "/v1/recall", {
      query: "updated durable",
      mode: "strict",
      user_id: "pg_user",
      project_id: "pg_project",
    });
    assertOk(recall, "recall");
    if (recall.body.adapter !== "durable-postgres" || recall.body.results.length !== 1) {
      throw new Error(`recall did not return durable result: ${JSON.stringify(recall.body)}`);
    }

    const explain = await getJson(
      baseUrl,
      `/v1/memories/${remember.body.id}/explain`,
    );
    assertOk(explain, "explain");
    if (
      explain.body.adapter !== "durable-postgres" ||
      explain.body.provenance.length !== 1 ||
      explain.body.versions.length !== 2 ||
      explain.body.audit_events.length < 3 ||
      typeof explain.body.score_components?.confidence !== "number"
    ) {
      throw new Error(`explain did not return durable provenance/version/audit: ${JSON.stringify(explain.body)}`);
    }

    const deleted = await fetch(`${baseUrl}/v1/memories/${remember.body.id}`, {
      method: "DELETE",
    });
    if (deleted.status !== 200) {
      throw new Error(`delete failed: ${deleted.status} ${await deleted.text()}`);
    }

    const afterDelete = await postJson(baseUrl, "/v1/recall", {
      query: "Ada Lovelace",
      user_id: "pg_user",
      project_id: "pg_project",
    });
    assertOk(afterDelete, "recall after delete");
    if (afterDelete.body.results.length !== 0) {
      throw new Error(`deleted memory returned by recall: ${JSON.stringify(afterDelete.body)}`);
    }

    console.log("[POSTGRES V1] integration verified");
  } finally {
    await pool.query(`drop schema if exists "${schema}" cascade`).catch(() => {});
    await pool.end().catch(() => {});
  }
}
