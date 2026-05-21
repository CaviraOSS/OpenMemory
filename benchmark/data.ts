import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  BenchmarkQuery,
  BenchmarkSample,
  DatasetConfig,
  DatasetSource,
} from "./types";

export interface LoadSamplesOptions {
  fetcher?: typeof fetch;
  useCache?: boolean;
  forceDownload?: boolean;
  download?: boolean;
}

export async function loadSamples(
  dataset: DatasetConfig,
  options: LoadSamplesOptions = {},
): Promise<BenchmarkSample[]> {
  if (dataset.source?.kind === "fixture") {
    return loadDatasetSource(dataset.source, dataset, options);
  }

  if (
    dataset.source &&
    (options.download ||
      options.forceDownload ||
      (await sourceCacheExists(dataset.source)))
  ) {
    try {
      return await loadDatasetSource(dataset.source, dataset, options);
    } catch (error) {
      if (!dataset.fixture_path) {
        throw error;
      }
    }
  }

  const path = dataset.data_path ?? dataset.fixture_path;
  if (!path) {
    return [];
  }

  const parsed = JSON.parse(await readFile(path, "utf8"));
  const samples = normalizeDatasetPayload(parsed, dataset);
  return samples.slice(0, dataset.max_test_samples);
}

async function sourceCacheExists(source: DatasetSource): Promise<boolean> {
  if (source.kind === "fixture" || !source.cache_path) {
    return false;
  }
  try {
    await access(source.cache_path);
    return true;
  } catch {
    return false;
  }
}

export async function loadDatasetSource(
  source: DatasetSource,
  dataset: DatasetConfig,
  options: LoadSamplesOptions = {},
): Promise<BenchmarkSample[]> {
  if (source.kind === "fixture") {
    const parsed = JSON.parse(await readFile(source.path, "utf8"));
    return normalizeDatasetPayload(parsed, dataset).slice(
      0,
      dataset.max_test_samples,
    );
  }

  const payload = await readSourcePayload(source, options);
  return normalizeDatasetPayload(payload, dataset).slice(
    0,
    dataset.max_test_samples,
  );
}

export function normalizeDatasetPayload(
  payload: unknown,
  dataset: DatasetConfig,
): BenchmarkSample[] {
  const direct = payload as {
    samples?: BenchmarkSample[];
    data?: unknown[];
  };
  if (Array.isArray(direct.samples)) {
    return direct.samples.map((sample, index) =>
      normalizeSample(sample, dataset, index),
    );
  }
  if (Array.isArray(direct.data)) {
    return direct.data.map((sample, index) =>
      normalizeMemoryAgentBenchSample(sample, dataset, index),
    );
  }
  if (Array.isArray(payload)) {
    return payload.map((sample, index) =>
      normalizeMemoryAgentBenchSample(sample, dataset, index),
    );
  }
  return [];
}

function normalizeSample(
  sample: BenchmarkSample,
  dataset: DatasetConfig,
  index: number,
): BenchmarkSample {
  return {
    ...sample,
    id: sample.id || `${dataset.sub_dataset}-${index}`,
    context: clipContext(sample.context ?? "", dataset),
    queries: sample.queries.map((query, queryIndex) =>
      normalizeQuery(query, queryIndex, sample.metadata),
    ),
    metadata: {
      benchmark: dataset.benchmark_id,
      sub_dataset: dataset.sub_dataset,
      ...sample.metadata,
    },
  };
}

function normalizeMemoryAgentBenchSample(
  raw: unknown,
  dataset: DatasetConfig,
  index: number,
): BenchmarkSample {
  const sample = raw as Record<string, any>;
  const metadata = sample.metadata ?? {};
  const qaRows = Array.isArray(sample.qa) ? sample.qa : undefined;
  const questions = ensureArray<string>(
    sample.questions ??
      sample.question ??
      sample.query ??
      sample.task ??
      qaRows?.map((qa: Record<string, unknown>) => qa.question),
  );
  const answers = ensureArray<string | string[]>(
    sample.answers ??
      sample.answer ??
      sample.ground_truth ??
      sample.target ??
      qaRows?.map((qa: Record<string, unknown>) => qa.answer),
  );
  const queries = questions.map((question, queryIndex) =>
    normalizeQuery(
      {
        id: pickIndexed(metadata.qa_pair_ids ?? sample.qa_pair_ids, queryIndex) ?? `${dataset.sub_dataset}-${index}-q${queryIndex}`,
        question,
        answers: ensureArray<string>(answers[queryIndex] ?? answers[0] ?? []),
        type: pickIndexed(
          metadata.question_types ??
            sample.question_types ??
            qaRows?.map((qa: Record<string, unknown>) => qa.category),
          queryIndex,
        ),
        timestamp: pickIndexed(metadata.question_dates ?? sample.question_dates, queryIndex),
        previous_events: ensureArray<string>(
          pickIndexed(metadata.previous_events ?? sample.previous_events, queryIndex) ?? [],
        ),
        source: metadata.source ?? sample.source,
        metadata: {
          question_id: pickIndexed(metadata.question_ids ?? sample.question_ids, queryIndex),
        },
      },
      queryIndex,
      metadata,
    ),
  );

  return {
    id: String(
      metadata.context_id ??
        sample.id ??
        sample.sample_id ??
        `${dataset.sub_dataset}-${index}`,
    ),
    context: clipContext(extractContext(sample), dataset),
    queries,
    metadata: {
      benchmark: dataset.benchmark_id,
      sub_dataset: dataset.sub_dataset,
      source: metadata.source ?? sample.source,
      ...metadata,
    },
  };
}

function normalizeQuery(
  query: BenchmarkQuery,
  index: number,
  sampleMetadata?: Record<string, unknown>,
): BenchmarkQuery {
  return {
    ...query,
    id: query.id || String(query.metadata?.question_id ?? `q${index}`),
    question: query.question,
    answers: ensureArray<string>(query.answers),
    source: query.source ?? String(sampleMetadata?.source ?? ""),
  };
}

function clipContext(context: string, dataset: DatasetConfig): string {
  const max = dataset.context_max_length;
  if (!max || context.length <= max) {
    return context;
  }
  return context.slice(0, max);
}

function ensureArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function pickIndexed(value: unknown, index: number): any {
  if (Array.isArray(value)) {
    return value[index] ?? value[0];
  }
  return value;
}

async function readSourcePayload(
  source: Exclude<DatasetSource, { kind: "fixture" }>,
  options: LoadSamplesOptions,
): Promise<unknown> {
  if (source.cache_path && options.useCache !== false && !options.forceDownload) {
    try {
      return JSON.parse(await readFile(source.cache_path, "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  const payload =
    source.kind === "huggingface_rows"
      ? await fetchHuggingFaceRows(source, options.fetcher ?? fetch)
      : await fetchTextSource(source, options.fetcher ?? fetch);

  if (source.cache_path && options.useCache !== false) {
    await mkdir(dirname(source.cache_path), { recursive: true });
    await writeFile(source.cache_path, JSON.stringify(payload, null, 2));
  }

  return payload;
}

async function fetchHuggingFaceRows(
  source: Extract<DatasetSource, { kind: "huggingface_rows" }>,
  fetcher: typeof fetch,
): Promise<{ data: unknown[] }> {
  const pageSize = Math.min(Math.max(source.page_size ?? 100, 1), 100);
  const rows: unknown[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const url = new URL("https://datasets-server.huggingface.co/rows");
    url.searchParams.set("dataset", source.dataset);
    url.searchParams.set("config", source.config ?? "default");
    url.searchParams.set("split", source.split);
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("length", String(pageSize));

    const response = await fetcher(url.toString());
    if (!response.ok) {
      throw new Error(`Hugging Face rows failed: ${response.status}`);
    }
    const page = (await response.json()) as { rows?: Array<{ row?: unknown }> };
    const pageRows = page.rows ?? [];
    if (pageRows.length === 0) {
      break;
    }

    for (const entry of pageRows) {
      const row = entry.row ?? entry;
      if (matchesSourceFilter(row, source.source_filter)) {
        rows.push(row);
      }
    }
    if (pageRows.length < pageSize) {
      break;
    }
  }

  return { data: rows };
}

async function fetchTextSource(
  source: Extract<DatasetSource, { kind: "huggingface_jsonl" | "url_json" }>,
  fetcher: typeof fetch,
): Promise<unknown> {
  const url =
    source.kind === "huggingface_jsonl"
      ? `https://huggingface.co/datasets/${source.dataset}/resolve/main/${source.path}`
      : source.url;
  const response = await fetcher(url);
  if (!response.ok) {
    throw new Error(`Dataset fetch failed: ${response.status}`);
  }
  const text = await response.text();
  const isJsonl =
    source.kind === "huggingface_jsonl" ||
    (source.kind === "url_json" && source.url.endsWith(".jsonl"));
  if (isJsonl) {
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }
  return JSON.parse(text);
}

function matchesSourceFilter(row: unknown, sourceFilter?: string): boolean {
  if (!sourceFilter) {
    return true;
  }
  const sample = row as Record<string, any>;
  return String(sample.metadata?.source ?? sample.source ?? "") === sourceFilter;
}

function extractContext(sample: Record<string, any>): string {
  const value =
    sample.context ??
    sample.haystack ??
    sample.trajectory ??
    sample.dialogue ??
    sample.conversation ??
    sample.history ??
    "";
  if (typeof value === "string") {
    return value;
  }
  if (sample.conversation && typeof sample.conversation === "object") {
    return flattenConversation(sample.conversation);
  }
  return JSON.stringify(value);
}

function flattenConversation(conversation: Record<string, any>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(conversation)) {
    if (!/^session_\d+$/.test(key) || !Array.isArray(value)) {
      continue;
    }
    const date = conversation[`${key}_date_time`];
    if (date) {
      parts.push(`[${date}]`);
    }
    for (const turn of value) {
      if (turn?.text) {
        parts.push(`${turn.speaker ?? "speaker"}: ${turn.text}`);
      }
    }
  }
  return parts.join("\n");
}
