import { env } from '../config';
import { SECTOR_CONFIGS } from '../hsg';
import { q } from '../database';
import { canonicalTokensFromText, addSynonymTokens } from '../utils/text';

// Global embedding queue for rate limiting
let geminiQueue: Promise<any> = Promise.resolve();
const GEMINI_COOLDOWN_MS = 1200; // 1.2s between requests

const OPENAI_MODEL_DIMENSIONS: Record<string, { min: number; max: number }> = {
  'text-embedding-3-small': { min: 256, max: 1536 },
  'text-embedding-3-large': { min: 1024, max: 3072 },
};

const DEFAULT_OPENAI_MODEL_MAP: Record<string, string> = {
  episodic: 'text-embedding-3-small',
  semantic: 'text-embedding-3-small',
  procedural: 'text-embedding-3-small',
  emotional: 'text-embedding-3-small',
  reflective: 'text-embedding-3-large',
};

function resolveTargetDimension(model: string): number | undefined {
  const constraints = OPENAI_MODEL_DIMENSIONS[model];
  const targetDim = env.vec_dim;

  if (!constraints || !Number.isFinite(targetDim) || targetDim <= 0) {
    return undefined;
  }

  if (targetDim >= constraints.min && targetDim <= constraints.max) {
    return targetDim;
  }

  return undefined;
}

function coerceEmbeddingDimension(vector: number[]): number[] {
  const targetDim = Number.isFinite(env.vec_dim) && env.vec_dim > 0 ? env.vec_dim : vector.length;
  return resizeVector(vector, targetDim);
}

function resolveOpenAIModel(sector: string): string {
  return env.openai_model || DEFAULT_OPENAI_MODEL_MAP[sector] || 'text-embedding-3-small';
}

function getOpenAIBaseUrl(): string {
  const baseUrl = typeof env.openai_base_url === 'string' ? env.openai_base_url.trim() : '';
  const raw = baseUrl !== '' ? baseUrl : 'https://api.openai.com/v1';
  return raw.replace(/\/$/, '');
}

export const emb_dim = () => env.vec_dim;
export interface EmbeddingResult {
  sector: string;
  vector: number[];
  dim: number;
}
export async function embedForSector(text: string, sector: string): Promise<number[]> {
  const config = SECTOR_CONFIGS[sector];
  if (!config) throw new Error(`Unknown sector: ${sector}`);

  switch (env.emb_kind) {
    case 'openai':
      return await embedWithOpenAI(text, sector);
    case 'gemini':
      const batch = await embedWithGemini({ [sector]: text });
      return batch[sector];
    case 'ollama':
      return await embedWithOllama(text, sector);
    case 'local':
      return await embedWithLocal(text, sector);
    case 'synthetic':
    default:
      return generateSyntheticEmbedding(text, sector);
  }
}

async function embedWithOpenAI(text: string, sector: string): Promise<number[]> {
  if (!env.openai_key) throw new Error('OpenAI API key not configured');

  const model = resolveOpenAIModel(sector);

  const body: Record<string, unknown> = {
    input: text,
    model,
  };

  const targetDim = resolveTargetDimension(model);
  if (targetDim) {
    body.dimensions = targetDim;
  }

  const baseUrl = getOpenAIBaseUrl();
  const response = await fetch(`${baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${env.openai_key}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let detail = '';
    try {
      detail = await response.text();
    } catch {
      // ignore body parsing failure
    }
    const suffix = detail ? ` - ${detail}` : '';
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}${suffix}`);
  }

  const data = (await response.json()) as any;
  const embedding = data.data[0].embedding as number[];
  return coerceEmbeddingDimension(embedding);
}

async function embedBatchOpenAI(texts: Record<string, string>): Promise<Record<string, number[]>> {
  if (!env.openai_key) throw new Error('OpenAI API key not configured');

  const model = env.openai_model || 'text-embedding-3-small';
  const inputTexts = Object.values(texts);
  const sectors = Object.keys(texts);

  const body: Record<string, unknown> = {
    input: inputTexts,
    model,
  };

  const targetDim = resolveTargetDimension(model);
  if (targetDim) {
    body.dimensions = targetDim;
  }

  const baseUrl = getOpenAIBaseUrl();
  const response = await fetch(`${baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${env.openai_key}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let detail = '';
    try {
      detail = await response.text();
    } catch {
      // ignore body parsing failure
    }
    const suffix = detail ? ` - ${detail}` : '';
    throw new Error(`OpenAI batch API error: ${response.status} ${response.statusText}${suffix}`);
  }

  const data = (await response.json()) as any;
  const out: Record<string, number[]> = {};

  for (let i = 0; i < sectors.length; i++) {
    const embedding = data.data[i].embedding as number[];
    out[sectors[i]] = coerceEmbeddingDimension(embedding);
  }

  return out;
}

async function embedWithGemini(texts: Record<string, string>): Promise<Record<string, number[]>> {
  if (!env.gemini_key) throw new Error('Gemini API key not configured');

  const promise = geminiQueue.then(async () => {
    const MAX_RETRIES = 3;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/embedding-001:batchEmbedContents?key=${env.gemini_key}`;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const requests = Object.entries(texts).map(([sector, t]) => ({
          model: 'models/embedding-001',
          content: { parts: [{ text: t }] },
          taskType: getSectorTaskType(sector),
        }));

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ requests }),
        });

        if (!response.ok) {
          if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get('retry-after') || '2');
            const delay = Math.min(retryAfter * 1000, 1000 * Math.pow(2, attempt));
            console.warn(`⚠️ Gemini batch rate limit (attempt ${attempt + 1}/${MAX_RETRIES}), waiting ${delay} ms…`);
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }
          throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
        }

        const data = (await response.json()) as any;
        const embeddings = data.embeddings as Array<{ values: number[] }>;
        const out: Record<string, number[]> = {};
        let i = 0;
        for (const sector of Object.keys(texts)) {
          out[sector] = resizeVector(embeddings[i++].values, env.vec_dim);
        }

        // cool-down between batches
        await new Promise((r) => setTimeout(r, 1500));
        return out;
      } catch (error) {
        if (attempt === MAX_RETRIES - 1) {
          console.error(`❌ Gemini batch failed after ${MAX_RETRIES} attempts, falling back to synthetic`);
          const fallback: Record<string, number[]> = {};
          for (const sector of Object.keys(texts)) {
            fallback[sector] = generateSyntheticEmbedding(texts[sector], sector);
          }
          return fallback;
        }
        const delay = 1000 * Math.pow(2, attempt);
        console.warn(`⚠️ Gemini batch error (attempt ${attempt + 1}/${MAX_RETRIES}): ${error instanceof Error ? error.message : String(error)}`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    const fallback: Record<string, number[]> = {};
    for (const sector of Object.keys(texts)) {
      fallback[sector] = generateSyntheticEmbedding(texts[sector], sector);
    }
    return fallback;
  });

  geminiQueue = promise.catch(() => {});
  return promise;
}

async function embedWithOllama(text: string, sector: string): Promise<number[]> {
  const modelMap: Record<string, string> = {
    episodic: 'nomic-embed-text',
    semantic: 'nomic-embed-text',
    procedural: 'bge-small',
    emotional: 'nomic-embed-text',
    reflective: 'bge-large',
  };

  const model = modelMap[sector] || 'nomic-embed-text';

  const response = await fetch(`${env.ollama_url}/api/embeddings`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as any;
  const embedding = data.embedding as number[];

  return resizeVector(embedding, env.vec_dim);
}

async function embedWithLocal(text: string, sector: string): Promise<number[]> {
  if (!env.local_model_path) {
    console.warn('Local model path not configured, falling back to synthetic');
    return generateSyntheticEmbedding(text, sector);
  }

  try {
    const { createHash } = await import('crypto');
    const hash = createHash('sha256')
      .update(text + sector)
      .digest();
    const embedding: number[] = [];

    for (let i = 0; i < env.vec_dim; i++) {
      const byte1 = hash[i % hash.length];
      const byte2 = hash[(i + 1) % hash.length];
      const value = ((byte1 * 256 + byte2) / 65535) * 2 - 1;
      embedding.push(value);
    }

    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map((val) => val / norm);
  } catch (error) {
    console.warn('Local embedding failed, falling back to synthetic:', error);
    return generateSyntheticEmbedding(text, sector);
  }
}

function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function addFeature(vector: Float32Array, dimension: number, key: string, weight: number) {
  const hash = hashString(key);
  const index = hash % dimension;
  const sign = (hash & 1) === 0 ? 1 : -1;
  vector[index] += weight * sign;
}

function normalizeVector(vector: Float32Array) {
  let norm = 0;
  for (let i = 0; i < vector.length; i++) {
    norm += vector[i] * vector[i];
  }
  norm = Math.sqrt(norm);
  if (!norm) return;
  for (let i = 0; i < vector.length; i++) {
    vector[i] /= norm;
  }
}

function generateSyntheticEmbedding(text: string, sector: string): number[] {
  const dimension = env.vec_dim || 768;
  const vector = new Float32Array(dimension).fill(0);
  const canonicalTokens = canonicalTokensFromText(text);
  if (canonicalTokens.length === 0) {
    for (let i = 0; i < dimension; i++) {
      vector[i] = 1 / Math.sqrt(dimension);
    }
    return Array.from(vector);
  }

  const enrichedTokens = Array.from(addSynonymTokens(canonicalTokens));
  const tokenCounts = new Map<string, number>();
  for (const token of enrichedTokens) {
    if (!token) continue;
    const count = tokenCounts.get(token) ?? 0;
    tokenCounts.set(token, count + 1);
  }

  for (const [token, count] of tokenCounts.entries()) {
    const weight = Math.log(1 + count) + 1;
    addFeature(vector, dimension, `${sector}|tok|${token}`, weight);

    if (token.length >= 3) {
      for (let i = 0; i < token.length - 2; i++) {
        const trigram = token.slice(i, i + 3);
        addFeature(vector, dimension, `${sector}|tri|${trigram}`, weight * 0.6);
      }
    }
  }

  for (let i = 0; i < canonicalTokens.length - 1; i++) {
    const a = canonicalTokens[i];
    const b = canonicalTokens[i + 1];
    if (!a || !b) continue;
    const key = `${sector}|bi|${a}_${b}`;
    addFeature(vector, dimension, key, 1.2);
  }

  normalizeVector(vector);
  return Array.from(vector);
}

function getSectorTaskType(sector: string): string {
  const taskTypes: Record<string, string> = {
    episodic: 'RETRIEVAL_DOCUMENT',
    semantic: 'SEMANTIC_SIMILARITY',
    procedural: 'RETRIEVAL_DOCUMENT',
    emotional: 'CLASSIFICATION',
    reflective: 'SEMANTIC_SIMILARITY',
  };
  return taskTypes[sector] || 'SEMANTIC_SIMILARITY';
}

function resizeVector(vector: number[], targetDim: number): number[] {
  if (vector.length === targetDim) return vector;

  if (vector.length > targetDim) {
    return vector.slice(0, targetDim);
  }

  const result = [...vector];
  while (result.length < targetDim) {
    result.push(0);
  }
  return result;
}
export async function embedMultiSector(id: string, text: string, sectors: string[], chunks?: Array<{ text: string }>): Promise<EmbeddingResult[]> {
  const results: EmbeddingResult[] = [];
  const MAX_RETRIES = 3;
  await q.ins_log.run(id, 'multi-sector', 'pending', Date.now(), null);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const useSimpleMode = env.embed_mode === 'simple';

      if (useSimpleMode && (env.emb_kind === 'gemini' || env.emb_kind === 'openai')) {
        console.log(`📦 Using SIMPLE mode (1 batch call for ${sectors.length} sectors)`);

        const textBySector: Record<string, string> = {};
        for (const sector of sectors) {
          textBySector[sector] = text;
        }

        let batch: Record<string, number[]>;
        if (env.emb_kind === 'gemini') {
          batch = await embedWithGemini(textBySector);
        } else {
          batch = await embedBatchOpenAI(textBySector);
        }

        for (const [sector, vec] of Object.entries(batch)) {
          results.push({ sector, vector: vec, dim: vec.length });
        }
      } else {
        console.log(`🔬 Using ADVANCED mode (${sectors.length} separate calls)`);

        const useParallel = env.adv_embed_parallel && env.emb_kind !== 'gemini';

        if (useParallel) {
          const promises = sectors.map(async (sector) => {
            let finalVector: number[];
            if (chunks && chunks.length > 1) {
              const chunkVectors: number[][] = [];
              for (const chunk of chunks) {
                const vec = await embedForSector(chunk.text, sector);
                chunkVectors.push(vec);
              }
              finalVector = aggregateChunkVectors(chunkVectors);
            } else {
              finalVector = await embedForSector(text, sector);
            }
            return { sector, vector: finalVector, dim: finalVector.length };
          });

          const sectorResults = await Promise.all(promises);
          results.push(...sectorResults);
        } else {
          for (const sector of sectors) {
            let finalVector: number[];

            if (chunks && chunks.length > 1) {
              const chunkVectors: number[][] = [];
              for (const chunk of chunks) {
                const vec = await embedForSector(chunk.text, sector);
                chunkVectors.push(vec);
              }
              finalVector = aggregateChunkVectors(chunkVectors);
            } else {
              finalVector = await embedForSector(text, sector);
            }

            results.push({
              sector,
              vector: finalVector,
              dim: finalVector.length,
            });

            if (env.embed_delay_ms > 0 && sector !== sectors[sectors.length - 1]) {
              await new Promise((r) => setTimeout(r, env.embed_delay_ms));
            }
          }
        }
      }

      await q.upd_log.run('completed', null, id);
      return results;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (attempt === MAX_RETRIES - 1) {
        await q.upd_log.run('failed', errorMessage, id);
        throw error;
      }

      const delay = 1000 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error('Embedding failed after retries');
}

/**
 * Aggregates chunk vectors using mean pooling (HMD v2 spec 4.3)
 */
function aggregateChunkVectors(vectors: number[][]): number[] {
  if (vectors.length === 0) throw new Error('No vectors to aggregate');
  if (vectors.length === 1) return vectors[0];

  const dim = vectors[0].length;
  const result = new Array(dim).fill(0);

  for (const vector of vectors) {
    for (let i = 0; i < dim; i++) {
      result[i] += vector[i];
    }
  }

  for (let i = 0; i < dim; i++) {
    result[i] /= vectors.length;
  }

  return result;
}
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
export function vectorToBuffer(vector: number[]): Buffer {
  const buffer = Buffer.allocUnsafe(vector.length * 4);
  for (let i = 0; i < vector.length; i++) {
    buffer.writeFloatLE(vector[i], i * 4);
  }
  return buffer;
}
export function bufferToVector(buffer: Buffer): number[] {
  const vector: number[] = [];
  for (let i = 0; i < buffer.length; i += 4) {
    vector.push(buffer.readFloatLE(i));
  }
  return vector;
}
export const embed = async (t: string) => embedForSector(t, 'semantic');

export function getEmbeddingProvider(): string {
  return env.emb_kind;
}

export function getEmbeddingInfo(): Record<string, any> {
  const info: Record<string, any> = {
    provider: env.emb_kind,
    dimensions: env.vec_dim,
    mode: env.embed_mode,
    batch_support: env.embed_mode === 'simple' && (env.emb_kind === 'gemini' || env.emb_kind === 'openai'),
    advanced_parallel: env.adv_embed_parallel,
    embed_delay_ms: env.embed_delay_ms,
  };

  switch (env.emb_kind) {
    case 'openai':
      info.configured = !!env.openai_key;
      info.base_url = getOpenAIBaseUrl();
      info.model_override = env.openai_model || null;
      info.batch_api = env.embed_mode === 'simple';
      info.models = {
        episodic: resolveOpenAIModel('episodic'),
        semantic: resolveOpenAIModel('semantic'),
        procedural: resolveOpenAIModel('procedural'),
        emotional: resolveOpenAIModel('emotional'),
        reflective: resolveOpenAIModel('reflective'),
      };
      break;
    case 'gemini':
      info.configured = !!env.gemini_key;
      info.batch_api = env.embed_mode === 'simple';
      info.model = 'embedding-001';
      break;
    case 'ollama':
      info.configured = true;
      info.url = env.ollama_url;
      info.models = {
        episodic: 'nomic-embed-text',
        semantic: 'nomic-embed-text',
        procedural: 'bge-small',
        emotional: 'nomic-embed-text',
        reflective: 'bge-large',
      };
      break;
    case 'local':
      info.configured = !!env.local_model_path;
      info.path = env.local_model_path;
      break;
    default:
      info.configured = true;
      info.type = 'synthetic';
  }

  return info;
}
