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

import type {
  DurableExecutor,
  WorkingMemoryEventInput,
} from "../durable/repository";
import {
  createExtractionCandidate,
  createWorkingMemoryEvent,
} from "../durable/repository";
import { buildExtractionCandidateInput } from "../durable/ingestion";

export class SourceError extends Error {
  constructor(
    message: string,
    readonly source?: string,
  ) {
    super(source ? `[${source}] ${message}` : message);
    this.name = "SourceError";
  }
}

export class SourceConfigError extends SourceError {
  constructor(message: string, source?: string) {
    super(message, source);
    this.name = "SourceConfigError";
  }
}

export class SourceAuthError extends SourceError {
  constructor(message: string, source?: string) {
    super(message, source);
    this.name = "SourceAuthError";
  }
}

export class SourceRateLimitError extends SourceError {
  constructor(
    message: string,
    readonly retry_after_ms?: number,
    source?: string,
  ) {
    super(message, source);
    this.name = "SourceRateLimitError";
  }
}

export type SourceItem = {
  id: string;
  name?: string;
  type?: string;
  uri?: string;
  metadata?: Record<string, unknown>;
};

export type SourceContent = {
  id: string;
  content: string | Buffer;
  name?: string;
  type?: string;
  uri?: string;
  content_type?: string;
  metadata?: Record<string, unknown>;
  observed_at?: string | Date;
};

export type SourceConnector = {
  kind: string;
  list(filters?: Record<string, unknown>): Promise<SourceItem[]>;
  fetch(item_id: string): Promise<SourceContent>;
};

export type SourceRetryOptions = {
  attempts?: number;
  base_delay_ms?: number;
  max_delay_ms?: number;
};

export class SourceRateLimiter {
  private tokens: number;
  private lastUpdate: number;
  private readonly requestsPerSecond: number;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    options: {
      requests_per_second?: number;
      now?: () => number;
      sleep?: (ms: number) => Promise<void>;
    } = {},
  ) {
    this.requestsPerSecond = Math.max(1, options.requests_per_second || 10);
    this.tokens = this.requestsPerSecond;
    this.now = options.now || Date.now;
    this.sleep = options.sleep || wait;
    this.lastUpdate = this.now();
  }

  async acquire(): Promise<void> {
    const now = this.now();
    const elapsed = Math.max(0, (now - this.lastUpdate) / 1000);
    this.tokens = Math.min(
      this.requestsPerSecond,
      this.tokens + elapsed * this.requestsPerSecond,
    );
    this.lastUpdate = now;

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    const waitMs = ((1 - this.tokens) / this.requestsPerSecond) * 1000;
    await this.sleep(waitMs);
    this.tokens = 0;
    this.lastUpdate = this.now();
  }
}

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function withSourceRetry<T>(
  fn: () => Promise<T>,
  options: SourceRetryOptions = {},
): Promise<T> {
  const attempts = Math.max(1, Math.min(5, Math.floor(options.attempts || 3)));
  const baseDelay = Math.max(0, options.base_delay_ms ?? 250);
  const maxDelay = Math.max(baseDelay, options.max_delay_ms ?? 5000);
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (
        error instanceof SourceConfigError ||
        error instanceof SourceAuthError
      ) {
        throw error;
      }
      if (attempt === attempts - 1) break;

      const retryAfter =
        error instanceof SourceRateLimitError
          ? error.retry_after_ms
          : undefined;
      const delay = retryAfter ?? Math.min(maxDelay, baseDelay * 2 ** attempt);
      if (delay > 0) await wait(delay);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new SourceError(String(lastError));
}

export function sourceContentToEvent(input: {
  connector_kind: string;
  content: SourceContent;
  user_id?: string;
  project_id?: string;
  contracts?: Record<string, unknown>;
}): WorkingMemoryEventInput {
  const content =
    typeof input.content.content === "string"
      ? input.content.content
      : input.content.content.toString("utf8");
  return {
    user_id: input.user_id,
    project_id: input.project_id,
    source: {
      kind: "provider_event",
      id: input.content.id,
      uri: input.content.uri,
      content_type: input.content.content_type || input.content.type,
    },
    content,
    metadata: {
      source_kind: input.connector_kind,
      source_name: input.content.name,
      ...(input.content.metadata || {}),
    },
    contracts: input.contracts,
    observed_at: input.content.observed_at,
  };
}

export async function ingestSourceConnector(
  db: DurableExecutor,
  connector: SourceConnector,
  options: {
    user_id?: string;
    project_id?: string;
    filters?: Record<string, unknown>;
    contracts?: Record<string, unknown>;
  } = {},
) {
  const items = await withSourceRetry(() => connector.list(options.filters));
  const events: Array<{ event_id: string; candidate_id: string }> = [];
  const errors: Array<{ item_id: string; error: string }> = [];

  for (const item of items) {
    try {
      const content = await withSourceRetry(() => connector.fetch(item.id));
      const eventInput = sourceContentToEvent({
        connector_kind: connector.kind,
        content,
        user_id: options.user_id,
        project_id: options.project_id,
        contracts: options.contracts,
      });
      const event = await createWorkingMemoryEvent(db, eventInput);
      const candidate = await createExtractionCandidate(
        db,
        buildExtractionCandidateInput({
          event_id: event.id,
          user_id: options.user_id,
          project_id: options.project_id,
          source: {
            kind: connector.kind,
            id: content.id,
            uri: content.uri,
            observed_at: content.observed_at,
          },
          content:
            typeof content.content === "string"
              ? content.content
              : content.content.toString("utf8"),
          metadata: content.metadata,
          contracts: options.contracts,
        }),
      );
      events.push({ event_id: event.id, candidate_id: candidate.id });
    } catch (error) {
      errors.push({
        item_id: item.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    ingested: events.length,
    failed: errors.length,
    events,
    errors,
  };
}
