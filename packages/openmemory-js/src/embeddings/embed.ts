/*
   ____                   __  __                                 
  / __ \                 |  \/  |                                
 | |  | |_ __   ___ _ __ | \  / | ___ _ __ ___   ___  _ __ _   _ 
 | |  | | '_ \ / _ \ '_ \| |\/| |/ _ \ '_ ` _ \ / _ \| '__| | | |
 | |__| | |_) |  __/ | | | |  | |  __/ | | | | | (_) | |  | |_| |
  \____/| .__/ \___|_| |_|_|  |_|\___|_| |_| |_|\___/|_|   \__, |
        | |                                                 __/ |
        |_|                                                |___/ 
  CaviraOSS @ 2026

 - filename
 - what is the file used for
*/

import { env } from "../configuration/index";
import { get_model } from "../database/models";
import { facetConfigs } from "./facets";
import {
  canonical_tokens_from_text,
  add_synonym_tokens,
} from "../utilities/text";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

let gem_q: Promise<any> = Promise.resolve();
export const emb_dim = () => env.vec_dim;

export function getEmbeddingTimeoutMs(): number {
  const timeout = Number(process.env.OM_EMBED_TIMEOUT_MS);
  return Number.isFinite(timeout) && timeout > 0 ? timeout : 30000;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    getEmbeddingTimeoutMs(),
  );
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function embedForFacet(
  text: string,
  facet: string,
): Promise<number[]> {
  if (!facetConfigs[facet]) throw new Error(`Unknown facet: ${facet}`);
  return await get_sem_emb(text, facet);
}

async function embed_with_provider(
  provider: string,
  t: string,
  s: string,
): Promise<number[]> {
  switch (provider) {
    case "openai":
      return await emb_openai(t, s);
    case "gemini":
      return (await emb_gemini({ [s]: t }))[s];
    case "ollama":
      return await emb_ollama(t, s);
    case "aws":
      return await emb_aws(t, s);
    case "local":
      return await emb_local(t, s);
    case "synthetic":
      return gen_syn_emb(t, s);
    case "siray":
      return await emb_siray(t, s);
    default:
      throw new Error(`Unknown embedding provider: ${provider}`);
  }
}

async function get_sem_emb(t: string, s: string): Promise<number[]> {
  const providers = [...new Set([env.emb_kind, ...env.embedding_fallback])];

  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    try {
      const result = await embed_with_provider(provider, t, s);
      if (i > 0) {
        console.error(
          `[EMBED] Fallback to ${provider} succeeded for facet: ${s}`,
        );
      }
      return result;
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      const nextProvider = providers[i + 1];

      if (nextProvider) {
        console.error(
          `[EMBED] ${provider} failed: ${errMsg}, trying ${nextProvider}`,
        );
      } else {
        console.error(
          `[EMBED] All providers failed. Last error (${provider}): ${errMsg}. Using synthetic.`,
        );
        return gen_syn_emb(t, s);
      }
    }
  }

  return gen_syn_emb(t, s);
}

async function emb_openai(t: string, s: string): Promise<number[]> {
  if (!env.openai_key) throw new Error("OpenAI key missing");
  const m = get_model(s, "openai");
  const r = await fetchWithTimeout(
    `${env.openai_base_url.replace(/\/$/, "")}/embeddings`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.openai_key}`,
      },
      body: JSON.stringify({
        input: t,
        model: env.openai_model || m,
        dimensions: env.vec_dim,
      }),
    },
  );
  if (!r.ok) throw new Error(`OpenAI: ${r.status}`);
  return ((await r.json()) as any).data[0].embedding;
}

const task_map: Record<string, string> = {
  episodic: "RETRIEVAL_DOCUMENT",
  semantic: "SEMANTIC_SIMILARITY",
  procedural: "RETRIEVAL_DOCUMENT",
  emotional: "CLASSIFICATION",
  reflective: "SEMANTIC_SIMILARITY",
};

const knownProviders = [
  "openai",
  "gemini",
  "ollama",
  "aws",
  "local",
  "synthetic",
  "siray",
];

const embeddingFacets = [
  "episodic",
  "semantic",
  "procedural",
  "emotional",
  "reflective",
];

function providerChain(): string[] {
  const providers = [env.emb_kind, ...env.embedding_fallback]
    .map((provider) => provider.trim().toLowerCase())
    .filter((provider) => knownProviders.includes(provider));
  return [...new Set(providers.length ? providers : ["synthetic"])];
}

function modelsForProvider(provider: string) {
  return Object.fromEntries(
    embeddingFacets.map((facet) => [facet, get_model(facet, provider)]),
  );
}

async function emb_gemini(
  txts: Record<string, string>,
): Promise<Record<string, number[]>> {
  if (!env.gemini_key) throw new Error("Gemini key missing");
  const prom = gem_q.then(async () => {
    for (let a = 0; a < 3; a++) {
      try {
        const model = get_model("semantic", "gemini");
        const url = `https://generativelanguage.googleapis.com/v1beta/${model.replace(/^models\//, "models/")}:batchEmbedContents?key=${env.gemini_key}`;
        const reqs = Object.entries(txts).map(([s, t]) => ({
          model: get_model(s, "gemini"),
          content: { parts: [{ text: t }] },
          taskType: task_map[s] || task_map.semantic,
        }));
        const r = await fetchWithTimeout(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ requests: reqs }),
        });
        if (!r.ok) {
          if (r.status === 429) {
            const d = Math.min(
              parseInt(r.headers.get("retry-after") || "2") * 1000,
              1000 * Math.pow(2, a),
            );
            console.error(
              `[EMBED] Gemini rate limit (${a + 1}/3), waiting ${d}ms`,
            );
            await new Promise((x) => setTimeout(x, d));
            continue;
          }
          throw new Error(`Gemini: ${r.status}`);
        }
        const data = (await r.json()) as any,
          out: Record<string, number[]> = {};
        let i = 0;
        for (const s of Object.keys(txts))
          out[s] = resize_vec(data.embeddings[i++].values, env.vec_dim);
        await new Promise((x) => setTimeout(x, 1500));
        return out;
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        if (a === 2) {
          throw new Error(`Gemini failed after 3 attempts: ${errMsg}`);
        }
        console.error(`[EMBED] Gemini error (${a + 1}/3): ${errMsg}`);
        await new Promise((x) => setTimeout(x, 1000 * Math.pow(2, a)));
      }
    }
    throw new Error("Gemini: exhausted retries");
  });
  gem_q = prom.catch(() => {});
  return prom;
}

async function emb_ollama(t: string, s: string): Promise<number[]> {
  const m = get_model(s, "ollama");
  const r = await fetchWithTimeout(`${env.ollama_url}/api/embeddings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: m, prompt: t }),
  });
  if (!r.ok) throw new Error(`Ollama: ${r.status}`);
  return resize_vec(((await r.json()) as any).embedding, env.vec_dim);
}
async function emb_aws(t: string, s: string): Promise<number[]> {
  if (!env.aws_region) throw new Error("AWS_REGION missing");
  if (!env.aws_access_key_id) throw new Error("AWS_ACCESS_KEY_ID missing");
  if (!env.aws_secret_access_key)
    throw new Error("AWS_SECRET_ACCESS_KEY missing");
  const m = get_model(s, "aws");
  const client = new BedrockRuntimeClient({ region: env.aws_region });
  const dim = [256, 512, 1024].find((x) => x >= env.vec_dim) ?? 1024;
  const params = {
    modelId: m,
    contentType: "application/json",
    accept: "*/*",
    body: JSON.stringify({
      inputText: t,
      dimensions: dim,
    }),
  };
  const command = new InvokeModelCommand(params);

  try {
    const response = await client.send(command);

    const jsonString = new TextDecoder().decode(response.body);
    const parsedResponse = JSON.parse(jsonString);
    return resize_vec(parsedResponse.embedding, env.vec_dim);
  } catch (error) {
    throw new Error(`AWS: ${error}`);
  }
}

async function emb_siray(t: string, s: string): Promise<number[]> {
  if (!env.siray_key) throw new Error("Siray key missing");
  const m = get_model(s, "siray");

  // Use direct fetch since we might need custom handling or just to be safe
  // adapting from emb_openai but with siray vars
  const r = await fetchWithTimeout(
    `${env.siray_base_url.replace(/\/$/, "")}/embeddings`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.siray_key}`,
      },
      body: JSON.stringify({
        input: t,
        model: m,
        // Siray docs didn't specify dimensions support for all models, assume standard if compatible
      }),
    },
  );
  if (!r.ok) throw new Error(`Siray: ${r.status}`);
  return ((await r.json()) as any).data[0].embedding;
}

async function emb_local(t: string, s: string): Promise<number[]> {
  if (!env.local_model_path) {
    console.error("[EMBED] Local model missing, using synthetic");
    return gen_syn_emb(t, s);
  }
  try {
    const { createHash } = await import("crypto");
    const h = createHash("sha256")
        .update(t + s)
        .digest(),
      e: number[] = [];
    for (let i = 0; i < env.vec_dim; i++) {
      const b1 = h[i % h.length],
        b2 = h[(i + 1) % h.length];
      e.push(((b1 * 256 + b2) / 65535) * 2 - 1);
    }
    const n = Math.sqrt(e.reduce((sum, v) => sum + v * v, 0));
    return e.map((v) => v / n);
  } catch {
    console.error("[EMBED] Local embedding failed, using synthetic");
    return gen_syn_emb(t, s);
  }
}

const h1 = (v: string) => {
  let h = 0x811c9dc5 | 0;
  for (let i = 0; i < v.length; i++)
    h = Math.imul(h ^ v.charCodeAt(i), 16777619);
  return h >>> 0;
};
const h2 = (v: string, sd: number) => {
  let h = sd | 0;
  for (let i = 0; i < v.length; i++) {
    h = Math.imul(h ^ v.charCodeAt(i), 0x5bd1e995);
    h = (h >>> 13) ^ h;
  }
  return h >>> 0;
};
const add_feat = (vec: Float32Array, dim: number, k: string, w: number) => {
  const h = h1(k),
    h_2 = h2(k, 0xdeadbeef),
    val = w * (1 - ((h & 1) << 1));
  if (dim > 0 && (dim & (dim - 1)) === 0) {
    vec[h & (dim - 1)] += val;
    vec[h_2 & (dim - 1)] += val * 0.5;
  } else {
    vec[h % dim] += val;
    vec[h_2 % dim] += val * 0.5;
  }
};
const add_pos_feat = (
  vec: Float32Array,
  dim: number,
  pos: number,
  w: number,
) => {
  const idx = pos % dim,
    ang = pos / Math.pow(10000, (2 * idx) / dim);
  vec[idx] += w * Math.sin(ang);
  vec[(idx + 1) % dim] += w * Math.cos(ang);
};
const sec_wts: Record<string, number> = {
  episodic: 1.3,
  semantic: 1.0,
  procedural: 1.2,
  emotional: 1.4,
  reflective: 0.9,
};
const norm_v = (v: Float32Array) => {
  let n = 0;
  for (let i = 0; i < v.length; i++) n += v[i] * v[i];
  if (n === 0) return;
  const inv = 1 / Math.sqrt(n);
  for (let i = 0; i < v.length; i++) v[i] *= inv;
};

export function gen_syn_emb(t: string, s: string): number[] {
  const d = env.vec_dim || 768,
    v = new Float32Array(d).fill(0),
    ct = canonical_tokens_from_text(t);
  if (!ct.length) {
    const x = 1 / Math.sqrt(d);
    return Array.from({ length: d }, () => x);
  }
  const et = Array.from(add_synonym_tokens(ct)),
    tc = new Map<string, number>(),
    el = et.length;
  for (let i = 0; i < el; i++) {
    const tok = et[i];
    tc.set(tok, (tc.get(tok) || 0) + 1);
  }
  const sw = sec_wts[s] || 1.0,
    dl = Math.log(1 + el);
  for (const [tok, c] of tc) {
    const tf = c / el,
      idf = Math.log(1 + el / c),
      w = (tf * idf + 1) * sw;
    add_feat(v, d, `${s}|tok|${tok}`, w);
    if (tok.length >= 3)
      for (let i = 0; i < tok.length - 2; i++)
        add_feat(v, d, `${s}|c3|${tok.slice(i, i + 3)}`, w * 0.4);
    if (tok.length >= 4)
      for (let i = 0; i < tok.length - 3; i++)
        add_feat(v, d, `${s}|c4|${tok.slice(i, i + 4)}`, w * 0.3);
  }
  for (let i = 0; i < ct.length - 1; i++) {
    const a = ct[i],
      b = ct[i + 1];
    if (a && b) {
      const pw = 1.0 / (1.0 + i * 0.1);
      add_feat(v, d, `${s}|bi|${a}_${b}`, 1.4 * sw * pw);
    }
  }
  for (let i = 0; i < ct.length - 2; i++) {
    const a = ct[i],
      b = ct[i + 1],
      c = ct[i + 2];
    if (a && b && c) add_feat(v, d, `${s}|tri|${a}_${b}_${c}`, 1.0 * sw);
  }
  for (let i = 0; i < Math.min(ct.length - 2, 20); i++) {
    const a = ct[i],
      c = ct[i + 2];
    if (a && c) add_feat(v, d, `${s}|skip|${a}_${c}`, 0.7 * sw);
  }
  for (let i = 0; i < Math.min(ct.length, 50); i++)
    add_pos_feat(v, d, i, (0.5 * sw) / dl);
  const lb = Math.min(Math.floor(Math.log2(el + 1)), 10);
  add_feat(v, d, `${s}|len|${lb}`, 0.6 * sw);
  const dens = tc.size / el,
    db = Math.floor(dens * 10);
  add_feat(v, d, `${s}|dens|${db}`, 0.5 * sw);
  norm_v(v);
  return Array.from(v);
}

const resize_vec = (v: number[], t: number) => {
  if (v.length === t) return v;
  if (v.length > t) return v.slice(0, t);
  return [...v, ...Array(t - v.length).fill(0)];
};

export const embed = (text: string) => embedForFacet(text, "semantic");
export const getEmbeddingProvider = () => env.emb_kind;

export const getEmbeddingInfo = () => {
  const i: Record<string, any> = {
    provider: env.emb_kind,
    fallback_chain: env.embedding_fallback,
    provider_chain: providerChain(),
    dimensions: env.vec_dim,
    timeout_ms: getEmbeddingTimeoutMs(),
  };
  if (env.emb_kind === "openai") {
    i.configured = !!env.openai_key;
    i.base_url = env.openai_base_url;
    i.model_override = env.openai_model || null;
    i.models = modelsForProvider("openai");
  } else if (env.emb_kind === "gemini") {
    i.configured = !!env.gemini_key;
    i.model = get_model("semantic", "gemini").replace(/^models\//, "");
    i.models = modelsForProvider("gemini");
  } else if (env.emb_kind === "aws") {
    i.configured =
      !!env.aws_region &&
      !!env.aws_access_key_id &&
      !!env.aws_secret_access_key;
    i.model = get_model("semantic", "aws");
    i.models = modelsForProvider("aws");
  } else if (env.emb_kind === "siray") {
    i.configured = !!env.siray_key;
    i.base_url = env.siray_base_url;
    i.models = modelsForProvider("siray");
  } else if (env.emb_kind === "ollama") {
    i.configured = true;
    i.url = env.ollama_url;
    i.models = modelsForProvider("ollama");
  } else if (env.emb_kind === "local") {
    i.configured = !!env.local_model_path;
    i.path = env.local_model_path;
    i.models = modelsForProvider("local");
  } else {
    i.configured = true;
    i.type = "synthetic";
    i.models = modelsForProvider("synthetic");
  }
  return i;
};
