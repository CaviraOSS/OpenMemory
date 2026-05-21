export const KNOWN_VECTOR_STORES = [
  "postgres",
  "qdrant",
  "valkey",
  "redis",
  "pinecone",
  "weaviate",
  "chroma",
  "milvus",
] as const;

export type VectorStoreKind = (typeof KNOWN_VECTOR_STORES)[number];

export interface VectorStoreConfig {
  kind: VectorStoreKind;
  collection: string;
  endpoint?: string;
  api_key?: string;
  timeout_ms: number;
}

export interface VectorRecord {
  id: string;
  embedding: number[];
  content?: string;
  user_id?: string;
  project_id?: string | null;
  metadata?: Record<string, unknown>;
}

export interface VectorQuery {
  embedding: number[];
  limit: number;
  user_id?: string;
  project_id?: string;
}

export interface VectorSearchResult {
  id: string;
  score?: number;
}

export interface VectorStore {
  kind: VectorStoreKind;
  info(): Record<string, unknown>;
  upsert(record: VectorRecord): Promise<void>;
  query(input: VectorQuery): Promise<VectorSearchResult[]>;
  delete(id: string): Promise<void>;
  health(): Promise<Record<string, unknown>>;
}

const str = (value: string | undefined, fallback = "") => value || fallback;
const num = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export function normalizeVectorStoreKind(
  value: string | undefined,
): VectorStoreKind {
  const normalized = (value || "postgres").trim().toLowerCase();
  if (normalized === "redis") return "valkey";
  return KNOWN_VECTOR_STORES.includes(normalized as VectorStoreKind)
    ? (normalized as VectorStoreKind)
    : "postgres";
}

export function getVectorStoreConfig(
  source: Record<string, string | undefined> = process.env,
): VectorStoreConfig {
  const kind = normalizeVectorStoreKind(source.OM_VECTOR_STORE);
  const collection = str(source.OM_VECTOR_COLLECTION, "openmemory_memories");
  const timeout_ms = num(source.OM_VECTOR_TIMEOUT_MS, 10000);
  const endpoint =
    source.OM_VECTOR_URL ||
    source[`OM_${kind.toUpperCase()}_URL`] ||
    source[`${kind.toUpperCase()}_URL`] ||
    (kind === "valkey" ? source.REDIS_URL : undefined) ||
    (kind === "pinecone" ? source.PINECONE_INDEX_HOST : undefined);
  const api_key =
    source.OM_VECTOR_API_KEY ||
    source[`OM_${kind.toUpperCase()}_API_KEY`] ||
    source[`${kind.toUpperCase()}_API_KEY`];

  return { kind, collection, endpoint, api_key, timeout_ms };
}

export function buildVectorStoreFilter(input: {
  user_id?: string;
  project_id?: string;
}) {
  return {
    ...(input.user_id ? { user_id: input.user_id } : {}),
    ...(input.project_id ? { project_id: input.project_id } : {}),
    include_global_project: !!input.project_id,
  };
}

function assertConfigured(config: VectorStoreConfig) {
  if (config.kind !== "postgres" && !config.endpoint) {
    throw new Error(`${config.kind} vector store endpoint is not configured`);
  }
}

async function requestJson(
  config: VectorStoreConfig,
  path: string,
  init: RequestInit = {},
) {
  assertConfigured(config);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeout_ms);
  const base = config.endpoint!.replace(/\/$/, "");
  try {
    const response = await fetch(`${base}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        ...(config.api_key
          ? { authorization: `Bearer ${config.api_key}` }
          : {}),
        ...(init.headers || {}),
      },
    });
    if (!response.ok) {
      throw new Error(`${config.kind} vector store HTTP ${response.status}`);
    }
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  } finally {
    clearTimeout(timeout);
  }
}

const payload = (record: VectorRecord) => ({
  id: record.id,
  user_id: record.user_id || null,
  project_id: record.project_id || null,
  content: record.content || "",
  metadata: record.metadata || {},
});

function qdrantStore(config: VectorStoreConfig): VectorStore {
  const headers: Record<string, string> = config.api_key
    ? { "api-key": config.api_key }
    : {};
  return {
    kind: "qdrant",
    info: () => ({ ...config, api_key: !!config.api_key }),
    async upsert(record) {
      await requestJson(
        config,
        `/collections/${config.collection}/points?wait=true`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify({
            points: [
              {
                id: record.id,
                vector: record.embedding,
                payload: payload(record),
              },
            ],
          }),
        },
      );
    },
    async query(input) {
      const filter = buildVectorStoreFilter(input);
      const must: unknown[] = [];
      const should: unknown[] = [];
      if (filter.user_id)
        must.push({ key: "user_id", match: { value: filter.user_id } });
      if (filter.project_id) {
        should.push({ key: "project_id", match: { value: filter.project_id } });
        should.push({ key: "project_id", match: { value: null } });
      }
      const data = await requestJson(
        config,
        `/collections/${config.collection}/points/search`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            vector: input.embedding,
            limit: input.limit,
            with_payload: false,
            filter:
              must.length || should.length
                ? {
                    ...(must.length ? { must } : {}),
                    ...(should.length ? { should } : {}),
                  }
                : undefined,
          }),
        },
      );
      return (data.result || []).map((row: any) => ({
        id: String(row.id),
        score: row.score,
      }));
    },
    async delete(id) {
      await requestJson(
        config,
        `/collections/${config.collection}/points/delete?wait=true`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ points: [id] }),
        },
      );
    },
    async health() {
      return requestJson(config, `/collections/${config.collection}`, {
        headers,
      });
    },
  };
}

function pineconeStore(config: VectorStoreConfig): VectorStore {
  const headers: Record<string, string> = config.api_key
    ? { "Api-Key": config.api_key }
    : {};
  return {
    kind: "pinecone",
    info: () => ({ ...config, api_key: !!config.api_key }),
    async upsert(record) {
      await requestJson(config, "/vectors/upsert", {
        method: "POST",
        headers,
        body: JSON.stringify({
          vectors: [
            {
              id: record.id,
              values: record.embedding,
              metadata: payload(record),
            },
          ],
        }),
      });
    },
    async query(input) {
      const data = await requestJson(config, "/query", {
        method: "POST",
        headers,
        body: JSON.stringify({
          vector: input.embedding,
          topK: input.limit,
          includeMetadata: false,
          filter: buildVectorStoreFilter(input),
        }),
      });
      return (data.matches || []).map((row: any) => ({
        id: String(row.id),
        score: row.score,
      }));
    },
    async delete(id) {
      await requestJson(config, "/vectors/delete", {
        method: "POST",
        headers,
        body: JSON.stringify({ ids: [id] }),
      });
    },
    async health() {
      return requestJson(config, "/describe_index_stats", {
        method: "POST",
        headers,
      });
    },
  };
}

function weaviateStore(config: VectorStoreConfig): VectorStore {
  return {
    kind: "weaviate",
    info: () => ({ ...config, api_key: !!config.api_key }),
    async upsert(record) {
      await requestJson(
        config,
        `/v1/objects/${config.collection}/${record.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            class: config.collection,
            id: record.id,
            vector: record.embedding,
            properties: payload(record),
          }),
        },
      );
    },
    async query(input) {
      const where = input.user_id
        ? {
            path: ["user_id"],
            operator: "Equal",
            valueText: input.user_id,
          }
        : undefined;
      const data = await requestJson(config, "/v1/graphql", {
        method: "POST",
        body: JSON.stringify({
          query: `{
            Get {
              ${config.collection}(
                nearVector: { vector: ${JSON.stringify(input.embedding)} }
                limit: ${input.limit}
                ${where ? `where: ${JSON.stringify(where).replace(/"([^"]+)":/g, "$1:")}` : ""}
              ) { id _additional { distance } }
            }
          }`,
        }),
      });
      return (data.data?.Get?.[config.collection] || []).map((row: any) => ({
        id: String(row.id),
        score: row._additional?.distance,
      }));
    },
    async delete(id) {
      await requestJson(config, `/v1/objects/${config.collection}/${id}`, {
        method: "DELETE",
      });
    },
    async health() {
      return requestJson(config, "/v1/.well-known/ready");
    },
  };
}

function chromaStore(config: VectorStoreConfig): VectorStore {
  return {
    kind: "chroma",
    info: () => ({ ...config, api_key: !!config.api_key }),
    async upsert(record) {
      await requestJson(
        config,
        `/api/v1/collections/${config.collection}/upsert`,
        {
          method: "POST",
          body: JSON.stringify({
            ids: [record.id],
            embeddings: [record.embedding],
            documents: [record.content || ""],
            metadatas: [payload(record)],
          }),
        },
      );
    },
    async query(input) {
      const data = await requestJson(
        config,
        `/api/v1/collections/${config.collection}/query`,
        {
          method: "POST",
          body: JSON.stringify({
            query_embeddings: [input.embedding],
            n_results: input.limit,
            where: buildVectorStoreFilter(input),
          }),
        },
      );
      const ids = data.ids?.[0] || [];
      const distances = data.distances?.[0] || [];
      return ids.map((id: string, index: number) => ({
        id,
        score: distances[index],
      }));
    },
    async delete(id) {
      await requestJson(
        config,
        `/api/v1/collections/${config.collection}/delete`,
        {
          method: "POST",
          body: JSON.stringify({ ids: [id] }),
        },
      );
    },
    async health() {
      return requestJson(config, "/api/v1/heartbeat");
    },
  };
}

function milvusStore(config: VectorStoreConfig): VectorStore {
  return {
    kind: "milvus",
    info: () => ({ ...config, api_key: !!config.api_key }),
    async upsert(record) {
      await requestJson(config, "/v2/vectordb/entities/upsert", {
        method: "POST",
        body: JSON.stringify({
          collectionName: config.collection,
          data: [{ ...payload(record), vector: record.embedding }],
        }),
      });
    },
    async query(input) {
      const data = await requestJson(config, "/v2/vectordb/entities/search", {
        method: "POST",
        body: JSON.stringify({
          collectionName: config.collection,
          data: [input.embedding],
          limit: input.limit,
          filter: input.user_id ? `user_id == "${input.user_id}"` : undefined,
          outputFields: ["id"],
        }),
      });
      return (data.data || []).map((row: any) => ({
        id: String(row.id),
        score: row.distance,
      }));
    },
    async delete(id) {
      await requestJson(config, "/v2/vectordb/entities/delete", {
        method: "POST",
        body: JSON.stringify({
          collectionName: config.collection,
          filter: `id == "${id}"`,
        }),
      });
    },
    async health() {
      return requestJson(config, "/v2/vectordb/collections/list", {
        method: "POST",
      });
    },
  };
}

function valkeyStore(config: VectorStoreConfig): VectorStore {
  const prefix = `om:${config.collection}:`;
  let indexReady = false;

  const connect = async () => {
    assertConfigured(config);
    const client = createClient({ url: config.endpoint });
    await client.connect();
    return client;
  };

  const encodeVector = (values: number[]) =>
    Buffer.from(new Float32Array(values).buffer);

  const tag = (value: string) => value.replace(/[\\{}\[\]|,]/g, "\\$&");

  const ensureIndex = async (
    client: Awaited<ReturnType<typeof connect>>,
    dim: number,
  ) => {
    if (indexReady) return;
    try {
      await client.sendCommand([
        "FT.CREATE",
        config.collection,
        "ON",
        "HASH",
        "PREFIX",
        "1",
        prefix,
        "SCHEMA",
        "id",
        "TAG",
        "user_id",
        "TAG",
        "project_id",
        "TAG",
        "content",
        "TEXT",
        "embedding",
        "VECTOR",
        "HNSW",
        "6",
        "TYPE",
        "FLOAT32",
        "DIM",
        String(dim),
        "DISTANCE_METRIC",
        "COSINE",
      ]);
    } catch (error) {
      if (!String(error).includes("Index already exists")) throw error;
    }
    indexReady = true;
  };

  return {
    kind: "valkey",
    info: () => ({
      ...config,
      api_key: false,
      driver: "redis",
    }),
    async upsert(record) {
      const client = await connect();
      try {
        await ensureIndex(client, record.embedding.length);
        await client.hSet(`${prefix}${record.id}`, {
          id: record.id,
          user_id: record.user_id || "",
          project_id: record.project_id || "__global__",
          content: record.content || "",
          embedding: encodeVector(record.embedding),
        });
      } finally {
        await client.quit();
      }
    },
    async query(input) {
      const client = await connect();
      try {
        await ensureIndex(client, input.embedding.length);
        const filters: string[] = [];
        if (input.user_id) filters.push(`@user_id:{${tag(input.user_id)}}`);
        if (input.project_id) {
          filters.push(
            `(@project_id:{${tag(input.project_id)}}|@project_id:{__global__})`,
          );
        }
        const base = filters.length ? filters.join(" ") : "*";
        const result = (await client.sendCommand([
          "FT.SEARCH",
          config.collection,
          `${base}=>[KNN ${input.limit} @embedding $vec AS vector_score]`,
          "PARAMS",
          "2",
          "vec",
          encodeVector(input.embedding),
          "RETURN",
          "1",
          "id",
          "SORTBY",
          "vector_score",
          "DIALECT",
          "2",
        ])) as unknown[];
        const rows: VectorSearchResult[] = [];
        for (let i = 1; i < result.length; i += 2) {
          const fields = result[i + 1] as unknown[];
          const idIndex = fields.findIndex((field) => field === "id");
          rows.push({
            id: String(idIndex >= 0 ? fields[idIndex + 1] : result[i]),
          });
        }
        return rows;
      } finally {
        await client.quit();
      }
    },
    async delete(id) {
      const client = await connect();
      try {
        await client.del(`${prefix}${id}`);
      } finally {
        await client.quit();
      }
    },
    async health() {
      const client = await connect();
      try {
        return { ok: (await client.ping()) === "PONG" };
      } finally {
        await client.quit();
      }
    },
  };
}

export function createVectorStore(
  config: VectorStoreConfig = getVectorStoreConfig(),
): VectorStore | null {
  switch (config.kind) {
    case "postgres":
      return null;
    case "qdrant":
      return qdrantStore(config);
    case "pinecone":
      return pineconeStore(config);
    case "weaviate":
      return weaviateStore(config);
    case "chroma":
      return chromaStore(config);
    case "milvus":
      return milvusStore(config);
    case "redis":
    case "valkey":
      return valkeyStore({ ...config, kind: "valkey" });
  }
}

export function getVectorStoreInfo(
  config: VectorStoreConfig = getVectorStoreConfig(),
) {
  return {
    ...config,
    api_key: !!config.api_key,
    active: config.kind !== "postgres",
    supported: KNOWN_VECTOR_STORES,
  };
}
import { createClient } from "redis";
