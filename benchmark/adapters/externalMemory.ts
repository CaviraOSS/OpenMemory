import type {
  AdapterAnswer,
  AgentConfig,
  BenchmarkQuery,
  BenchmarkSample,
  MemoryBenchmarkAdapter,
} from "../types";

export type AnswerGenerator = (input: {
  system: string;
  user: string;
  context: string;
  query: BenchmarkQuery;
  sample: BenchmarkSample;
}) => Promise<string> | string;

export interface Mem0Client {
  add(messages: Array<{ role: string; content: string }>, options: { user_id: string }): unknown;
  search(input: { query: string; user_id: string; limit: number } | string, options?: { user_id: string; limit: number }): unknown;
}

export interface CogneeClient {
  add(text: string, options: { dataset_name: string }): Promise<unknown> | unknown;
  cognify(options: { datasets: string[]; chunk_size: number }): Promise<unknown> | unknown;
  search(options: { query_text: string; top_k: number; datasets: string[] }): Promise<unknown> | unknown;
}

export interface ZepClient {
  user: { add(input: { user_id: string }): Promise<unknown> | unknown };
  thread: {
    create(input: { thread_id: string; user_id: string }): Promise<unknown> | unknown;
    addMessages(input: { thread_id: string; messages: unknown[] }): Promise<unknown> | unknown;
    getUserContext(input: { thread_id: string }): Promise<{ context?: string }> | { context?: string };
  };
  graph: {
    create(input: { graph_id: string }): Promise<unknown> | unknown;
    add(input: { graph_id: string; type: "text"; data: string }): Promise<unknown> | unknown;
    search(input: { graph_id: string; query: string; scope: "edges" | "nodes" | "episodes"; limit: number }): Promise<unknown> | unknown;
  };
}

export interface SupermemoryClient {
  add(input: { content: string; container: string; metadata?: Record<string, unknown> }): Promise<unknown> | unknown;
  search(input: { query: string; container: string; limit: number }): Promise<unknown> | unknown;
}

export function createMem0Adapter(options: {
  memory: Mem0Client;
  generate: AnswerGenerator;
  retrieveNum?: number;
}): MemoryBenchmarkAdapter {
  const retrieveNum = options.retrieveNum ?? 100;
  let started = Date.now();

  return {
    reset() {
      started = Date.now();
    },
    async ingest(chunk, sample) {
      await options.memory.add(
        [
          {
            role: "system",
            content: "You are a helpful assistant that memorizes user-provided context.",
          },
          { role: "user", content: chunk },
          {
            role: "assistant",
            content: "I'll make sure to add the content into the memory.",
          },
        ],
        { user_id: userId(sample) },
      );
    },
    async answer(query, sample) {
      const memoryConstructionTime = secondsSince(started);
      const searchResult = await options.memory.search({
        query: query.question,
        user_id: userId(sample),
        limit: retrieveNum,
      });
      const memories = extractMemoryStrings(searchResult);
      const context = memories.map((memory) => `- ${memory}`).join("\n");
      const output = await options.generate({
        system: `You are a helpful AI. Answer the question based on query and memories.\n${context}\n`,
        user: `${query.question}\n\nCurrent Time: ${new Date().toISOString()}`,
        context,
        query,
        sample,
      });

      return answer(query, output, context, memoryConstructionTime, secondsSince(started) - memoryConstructionTime, memories);
    },
  };
}

export function createCogneeAdapter(options: {
  cognee: CogneeClient;
  retrieveNum?: number;
  chunkSize?: number;
}): MemoryBenchmarkAdapter {
  const retrieveNum = options.retrieveNum ?? 10;
  const chunkSize = options.chunkSize ?? 4096;
  let started = Date.now();

  return {
    reset() {
      started = Date.now();
    },
    async ingest(chunk, sample) {
      const dataset_name = datasetName(sample);
      await options.cognee.add(chunk, { dataset_name });
      await options.cognee.cognify({ datasets: [dataset_name], chunk_size: chunkSize });
    },
    async answer(query, sample) {
      const memoryConstructionTime = secondsSince(started);
      const searched = await options.cognee.search({
        query_text: query.question,
        top_k: retrieveNum,
        datasets: [datasetName(sample)],
      });
      const results = extractMemoryStrings(searched);
      const output = results.length ? results.map((result) => `${result}\n`).join("") : "No results found.";
      return answer(query, output, output, memoryConstructionTime, secondsSince(started) - memoryConstructionTime, results);
    },
  };
}

export function createZepAdapter(options: {
  zep: ZepClient;
  generate: AnswerGenerator;
  retrieveNum?: number;
}): MemoryBenchmarkAdapter {
  const retrieveNum = options.retrieveNum ?? 10;
  const initialized = new Set<string>();
  let started = Date.now();

  return {
    reset() {
      started = Date.now();
    },
    async ingest(chunk, sample) {
      const ids = zepIds(sample);
      if (!initialized.has(sample.id)) {
        await options.zep.user.add({ user_id: ids.user_id });
        await options.zep.thread.create({ thread_id: ids.thread_id, user_id: ids.user_id });
        await options.zep.graph.create({ graph_id: ids.graph_id });
        initialized.add(sample.id);
      }
      await options.zep.graph.add({
        graph_id: ids.graph_id,
        type: "text",
        data: chunk.slice(0, 9998),
      });
      await options.zep.thread.addMessages({
        thread_id: ids.thread_id,
        messages: constructZepMessages(chunk, ids.user_id),
      });
    },
    async answer(query, sample) {
      const ids = zepIds(sample);
      const memoryConstructionTime = secondsSince(started);
      const retrievalQuery = extractRetrievalQuery(query.question).slice(0, 399);
      const edges = await options.zep.graph.search({ graph_id: ids.graph_id, query: retrievalQuery, scope: "edges", limit: retrieveNum });
      const nodes = await options.zep.graph.search({ graph_id: ids.graph_id, query: retrievalQuery, scope: "nodes", limit: retrieveNum });
      const episodes = await options.zep.graph.search({ graph_id: ids.graph_id, query: retrievalQuery, scope: "episodes", limit: retrieveNum });
      const thread = await options.zep.thread.getUserContext({ thread_id: ids.thread_id });
      const context = composeZepContext(edges, nodes, thread.context ?? "", episodes);
      const output = await options.generate({
        system: "Answer the question using the retrieved Zep context.",
        user: query.question,
        context,
        query,
        sample,
      });
      return answer(query, output, context, memoryConstructionTime, secondsSince(started) - memoryConstructionTime, context.split("\n").filter(Boolean));
    },
  };
}

export function createSupermemoryAdapter(options: {
  client: SupermemoryClient;
  generate: AnswerGenerator;
  retrieveNum?: number;
}): MemoryBenchmarkAdapter {
  const retrieveNum = options.retrieveNum ?? 10;
  let started = Date.now();

  return {
    reset() {
      started = Date.now();
    },
    async ingest(chunk, sample) {
      await options.client.add({
        content: chunk,
        container: sample.id,
        metadata: { benchmark: sample.metadata?.benchmark },
      });
    },
    async answer(query, sample) {
      const memoryConstructionTime = secondsSince(started);
      const searchResult = await options.client.search({
        query: query.question,
        container: sample.id,
        limit: retrieveNum,
      });
      const results = extractMemoryStrings(searchResult);
      const context = results.join("\n");
      const output = await options.generate({
        system: "Answer the question using the retrieved Supermemory context.",
        user: query.question,
        context,
        query,
        sample,
      });
      return answer(query, output, context, memoryConstructionTime, secondsSince(started) - memoryConstructionTime, results);
    },
  };
}

export function createExternalMemoryAdapterFromAgentConfig(
  agent: AgentConfig,
): MemoryBenchmarkAdapter {
  const generate = createAnswerGenerator(agent);
  const retrieveNum = agent.retrieve_num ?? 10;

  if (agent.adapter === "mem0") {
    return createMem0Adapter({
      retrieveNum,
      memory: createMem0Client(agent),
      generate,
    });
  }
  if (agent.adapter === "cognee") {
    return createCogneeAdapter({
      retrieveNum,
      chunkSize: agent.agent_chunk_size ?? 4096,
      cognee: createCogneeHttpClient(agent),
    });
  }
  if (agent.adapter === "zep") {
    return createZepAdapter({
      retrieveNum,
      zep: createZepClient(agent),
      generate,
    });
  }
  if (agent.adapter === "supermemory") {
    return createSupermemoryAdapter({
      retrieveNum,
      client: createSupermemoryClient(agent),
      generate,
    });
  }
  throw new Error(`Unsupported external memory adapter: ${agent.adapter}`);
}

function answer(
  query: BenchmarkQuery,
  output: string,
  context: string,
  memoryConstructionTime: number,
  queryTimeLen: number,
  retrievalContext: unknown,
): AdapterAnswer {
  return {
    output,
    input_len: query.question.length + context.length,
    output_len: output.length,
    memory_construction_time: memoryConstructionTime,
    query_time_len: Math.max(0, queryTimeLen),
    retrieval_context: retrievalContext,
  };
}

function userId(sample: BenchmarkSample): string {
  return `context_${sample.id}_${subDataset(sample)}`;
}

function datasetName(sample: BenchmarkSample): string {
  return `default_dataset_${subDataset(sample)}_context_${sample.id}`;
}

function zepIds(sample: BenchmarkSample) {
  const suffix = `${sample.id}_${subDataset(sample)}`;
  return {
    user_id: `user_${suffix}`,
    graph_id: `graph_${suffix}`,
    thread_id: `thread_${suffix}`,
  };
}

function subDataset(sample: BenchmarkSample): string {
  return String(sample.metadata?.sub_dataset ?? sample.metadata?.benchmark ?? "benchmark");
}

function secondsSince(started: number): number {
  return (Date.now() - started) / 1000;
}

function extractMemoryStrings(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(stringifyMemory).filter(Boolean);
  }
  const object = value as Record<string, unknown>;
  for (const key of ["results", "memories", "edges", "nodes", "episodes"]) {
    const nested = object?.[key];
    if (Array.isArray(nested)) {
      return nested.map(stringifyMemory).filter(Boolean);
    }
  }
  return value == null ? [] : [stringifyMemory(value)].filter(Boolean);
}

function stringifyMemory(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  const object = value as Record<string, unknown>;
  const text = object?.memory ?? object?.content ?? object?.text ?? object?.summary;
  return typeof text === "string" ? text : JSON.stringify(value);
}

function constructZepMessages(content: string, userId: string): unknown[] {
  return [
    { role: "user", name: userId, content: content.slice(0, 2400) },
    { role: "assistant", name: "AI Assistant", content: "Hello! I will memorize the content for you." },
  ];
}

function composeZepContext(edges: unknown, nodes: unknown, threadContext: string, episodes: unknown): string {
  const edgeRows = extractZepItems(edges, "edges");
  const nodeRows = extractZepItems(nodes, "nodes");
  const episodeRows = extractZepItems(episodes, "episodes");
  const facts = edgeRows.map((edge) => {
    const fact = stringField(edge, "fact") ?? stringifyMemory(edge);
    return `  - ${fact} (${formatZepEdgeDateRange(edge)})`;
  });
  const entities = nodeRows.map((node) => {
    const name = stringField(node, "name") ?? "entity";
    const summary = stringField(node, "summary") ?? stringifyMemory(node);
    return `  - ${name}: ${summary}`;
  });
  const episodeTexts = episodeRows.map((episode) => {
    const content = stringField(episode, "content") ?? stringifyMemory(episode);
    return `  - Content: ${content}`;
  });

  return [
    "FACTS and ENTITIES represent relevant context to the current conversation.",
    "",
    "# These are the most relevant facts and their valid date ranges. If the fact is about an event, the event takes place during this time.",
    "# format: FACT (Date range: from - to)",
    "",
    facts.join("\n"),
    "",
    "",
    "# These are the most relevant entities",
    "# ENTITY_NAME: entity summary",
    "",
    entities.join("\n"),
    "",
    "",
    "# These are the most relevant episodes.",
    "# format: EPISODE",
    "",
    episodeTexts.join("\n"),
    threadContext ? `\n${threadContext}` : "",
  ].join("\n");
}

function extractRetrievalQuery(query: string): string {
  const eventMarker = "These are the events";
  const endMarkers = ["Your task is to", "Below is a list of possible subsequent events:"];
  const endIndexes = endMarkers
    .map((marker) => query.indexOf(marker))
    .filter((index) => index >= 0);
  if (endIndexes.length) {
    const end = Math.min(...endIndexes);
    const start = query.lastIndexOf(eventMarker, end);
    if (start >= 0) {
      return query.slice(start, end).trim();
    }
  }

  for (const pattern of [/Now Answer the Question:\s*([\s\S]*)/, /Here is the conversation:\s*([\s\S]*)/]) {
    const match = query.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }
  return query;
}

function extractZepItems(value: unknown, key: "edges" | "nodes" | "episodes"): Array<Record<string, unknown>> {
  const object = value as Record<string, unknown>;
  const nested = object?.[key];
  const items = Array.isArray(nested) ? nested : Array.isArray(value) ? value : [];
  return items.map((item) => item as Record<string, unknown>);
}

function formatZepEdgeDateRange(edge: Record<string, unknown>): string {
  return `${stringField(edge, "valid_at") ?? "date unknown"} - ${stringField(edge, "invalid_at") ?? "present"}`;
}

function stringField(object: Record<string, unknown>, field: string): string | undefined {
  const value = object[field];
  return typeof value === "string" ? value : undefined;
}

function createAnswerGenerator(agent: AgentConfig): AnswerGenerator {
  const provider = agent.llm_provider ?? "openai";
  const apiKey =
    agent.api_key ??
    process.env.OM_BENCHMARK_LLM_API_KEY ??
    (provider === "gemini"
      ? process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY
      : provider === "siray"
        ? process.env.SIRAY_API_KEY
        : process.env.OPENAI_API_KEY);
  if (!apiKey) {
    return () => {
      throw new Error(
        `Missing ${provider} API key for benchmark answer generation. Set OM_BENCHMARK_LLM_API_KEY or the provider-specific key before running real competitor benchmarks.`,
      );
    };
  }

  const fetcher = fetch;
  const model =
    agent.model ??
    (provider === "gemini"
      ? "gemini-2.0-flash"
      : provider === "siray"
        ? "gpt-5.2-chat"
        : "gpt-4o-mini");

  return async ({ system, user }) => {
    if (provider === "gemini") {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const response = await fetcher(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          generationConfig: { temperature: agent.temperature ?? 0 },
          contents: [{ role: "user", parts: [{ text: `${system}\n${user}` }] }],
        }),
      });
      if (!response.ok) throw new Error(`Gemini answer generation failed: ${response.status}`);
      const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      return payload.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    }

    const baseUrl = provider === "siray" ? "https://api.siray.ai/v1" : (agent.api_base_url ?? "https://api.openai.com/v1");
    const response = await fetcher(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: agent.temperature ?? 0,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!response.ok) throw new Error(`Answer generation failed: ${response.status}`);
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return payload.choices?.[0]?.message?.content ?? "";
  };
}

function createMem0Client(agent: AgentConfig): Mem0Client {
  let clientPromise: Promise<any> | undefined;
  async function client() {
    clientPromise ??= importOptional("mem0ai").then((mod) => {
      const Constructor = mod.MemoryClient ?? mod.Memory ?? mod.default;
      if (!Constructor) {
        throw new Error("mem0ai package does not export MemoryClient/Memory/default");
      }
      return new Constructor({ apiKey: agent.memory_api_key ?? process.env.MEM0_API_KEY });
    });
    return clientPromise;
  }
  return {
    async add(messages, options) {
      const memory = await client();
      return memory.add(messages, options);
    },
    async search(input, options) {
      const memory = await client();
      return typeof input === "string" ? memory.search(input, options) : memory.search(input);
    },
  };
}

function createCogneeHttpClient(agent: AgentConfig): CogneeClient {
  const baseUrl = requiredMemoryBaseUrl(agent, "Cognee");
  return {
    add: (text, options) => postJson(`${baseUrl}/add`, { text, ...options }, agent.memory_api_key),
    cognify: (options) => postJson(`${baseUrl}/cognify`, options, agent.memory_api_key),
    search: (options) => postJson(`${baseUrl}/search`, options, agent.memory_api_key),
  };
}

function createZepClient(agent: AgentConfig): ZepClient {
  let clientPromise: Promise<any> | undefined;
  async function client() {
    clientPromise ??= importOptional("@getzep/zep-cloud").then((mod) => {
      const Constructor = mod.ZepClient ?? mod.Zep ?? mod.default;
      if (!Constructor) {
        throw new Error("@getzep/zep-cloud package does not export ZepClient/Zep/default");
      }
      return new Constructor({ apiKey: agent.memory_api_key ?? process.env.ZEP_API_KEY });
    });
    return clientPromise;
  }
  return {
    user: { add: async (input) => (await client()).user.add(input) },
    thread: {
      create: async (input) => (await client()).thread.create(input),
      addMessages: async (input) => {
        const zep = await client();
        return (zep.thread.addMessages ?? zep.thread.add_messages).call(zep.thread, input);
      },
      getUserContext: async (input) => {
        const zep = await client();
        return (zep.thread.getUserContext ?? zep.thread.get_user_context).call(zep.thread, input);
      },
    },
    graph: {
      create: async (input) => (await client()).graph.create(input),
      add: async (input) => (await client()).graph.add(input),
      search: async (input) => (await client()).graph.search(input),
    },
  };
}

function createSupermemoryClient(agent: AgentConfig): SupermemoryClient {
  let clientPromise: Promise<any> | undefined;
  async function client() {
    clientPromise ??= importOptional("supermemory").then((mod) => {
      const Constructor = mod.default ?? mod.Supermemory;
      if (!Constructor) {
        throw new Error("supermemory package does not export default/Supermemory");
      }
      return new Constructor({ apiKey: agent.memory_api_key ?? process.env.SUPERMEMORY_API_KEY });
    });
    return clientPromise;
  }
  return {
    async add(input) {
      return (await client()).add(input);
    },
    async search(input) {
      const supermemory = await client();
      if (supermemory.search?.documents) {
        return supermemory.search.documents({ q: input.query, limit: input.limit, container: input.container });
      }
      return supermemory.search(input);
    },
  };
}

async function importOptional(name: string): Promise<any> {
  try {
    const dynamicImport = new Function("name", "return import(name)") as (name: string) => Promise<any>;
    return await dynamicImport(name);
  } catch (error) {
    throw new Error(`Install optional benchmark dependency '${name}' or configure a benchmark HTTP bridge: ${(error as Error).message}`);
  }
}

function requiredMemoryBaseUrl(agent: AgentConfig, name: string): string {
  if (!agent.memory_api_base_url) {
    throw new Error(`${name} benchmark adapter requires memory_api_base_url because no stable TypeScript SDK is available`);
  }
  return agent.memory_api_base_url.replace(/\/$/, "");
}

async function postJson(url: string, body: unknown, apiKey?: string): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${url} failed with ${response.status}`);
  }
  return response.json();
}
