/*
*      __                      __  ___                               
*     / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
*    / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
*   / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ / 
*  /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /  
                     /____/                                 /____/   
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : benchmarks/src/providers/graphiti.ts
 *  usage : supports LongMemory benchmark graphiti
 */

import { http_client } from "./http";
import { array, as_hits, attributed_text, ignore_missing, provider_metadata, record, route, scope_key, text, unwrap, wait } from "./shared";
import type { benchmark_event, benchmark_provider, benchmark_scope, ingest_result, provider_config, route_config, search_hit } from "../types";
import { benchmark_source_ref } from "../source_ref";

const defaults: route_config = {
    health: "/healthcheck",
    reset: "/group/:scope",
    ingest: "/messages",
    search: "/search",
    indexing: "/episodes/:scope?last_n=:count",
};

const cloud_defaults: route_config = {
    health: "/graph/list-all?pageNumber=1&pageSize=1",
    reset: "/graph/:scope",
    ingest: "/batches",
    search: "/graph/search",
    indexing: "/batches/:id",
};

export class graphiti_provider implements benchmark_provider {
    readonly name = "graphiti" as const;
    private client: http_client | null = null;
    private routes = defaults;
    private timeout_ms = 120_000;
    private cloud = true;
    private readonly readiness_queries = new Map<string, string>();
    private readonly batch_totals = new Map<string, number>();

    get display_name(): string {
        return this.cloud ? "zep api" : "graphiti local";
    }

    async initialize(config: provider_config): Promise<void> {
        this.cloud = config.profile !== "local" && config.profile !== "oss";
        if (this.cloud && !config.api_key) throw new Error("Zep Cloud requires ZEP_API_KEY or BENCH_GRAPHITI_API_KEY");
        this.routes = { ...(this.cloud ? cloud_defaults : defaults), ...config.routes };
        this.timeout_ms = config.timeout_ms ?? 120_000;
        this.client = new http_client({
            ...config,
            auth_header: this.cloud ? "authorization" : undefined,
            auth_prefix: this.cloud ? "Api-Key " : undefined,
        });
    }

    private api(): http_client {
        if (!this.client) throw new Error("graphiti is not initialized");
        return this.client;
    }

    async health(): Promise<void> {
        await this.api().get(this.routes.health);
    }

    async reset(scope: benchmark_scope): Promise<void> {
        if (this.cloud) {
            await ignore_missing(() => this.api().delete(route(this.routes.reset, { scope: this.group(scope) })));
            await this.api().post("/graph/create", {
                graph_id: this.group(scope),
                name: `LongMemory benchmark ${scope.corpus_id}`,
                description: `Benchmark run ${scope.run_id}`,
            });
            return;
        }
        await ignore_missing(() => this.api().delete(route(this.routes.reset, { scope: this.group(scope) })));
    }

    async ingest(events: benchmark_event[], scope: benchmark_scope): Promise<ingest_result> {
        if (this.cloud) {
            const response = record(unwrap(await this.api().post(this.routes.ingest, {
                metadata: { description: `LongMemory benchmark ${scope.run_id}:${scope.corpus_id}` },
            })));
            const batch_id = text(response.batch_id, response.batchId, response.id);
            if (!batch_id) throw new Error("Zep did not return a batch ID");
            for (let index = 0; index < events.length; index += 350) {
                await this.api().post(`/batches/${encodeURIComponent(batch_id)}/items`, {
                    items: events.slice(index, index + 350).map((event) => ({
                        type: "graph_episode",
                        graph_id: this.group(scope),
                        data: attributed_text(event),
                        data_type: "text",
                        created_at: new Date(event.timestamp).toISOString(),
                        source_description: `LongMemory benchmark ${scope.run_id}`,
                        metadata: { ...provider_metadata(event.metadata), source_ref: benchmark_source_ref(event) },
                    })),
                });
            }
            await this.api().post(`/batches/${encodeURIComponent(batch_id)}/process`);
            this.readiness_queries.set(this.group(scope), [...attributed_text(events[0])].slice(0, 400).join(""));
            this.batch_totals.set(batch_id, events.length);
            return { ids: events.map(benchmark_source_ref), pending_ids: [batch_id] };
        }
        await this.api().post(this.routes.ingest, {
            group_id: this.group(scope),
            messages: events.map((event) => ({
                uuid: event.id,
                name: event.id,
                role_type: "user",
                role: "benchmark",
                content: event.text,
                timestamp: new Date(event.timestamp).toISOString(),
                source_description: `longmemory benchmark ${scope.run_id}`,
            })),
        });
        const ids = events.map((event) => event.id);
        return { ids, pending_ids: ids };
    }

    async await_indexing(result: ingest_result, scope: benchmark_scope, progress?: (value: { completed: number; failed: number; total: number }) => void): Promise<void> {
        if (this.cloud) {
            const batch_id = result.pending_ids?.[0];
            if (!batch_id) throw new Error("Zep batch ID is missing");
            const total = this.batch_totals.get(batch_id) ?? result.ids.length;
            const started = Date.now();
            while (true) {
                const response = record(unwrap(await this.api().get(route(this.routes.indexing ?? cloud_defaults.indexing!, { id: batch_id }))));
                const status = text(response.status).toLowerCase();
                const batch_progress = record(response.progress);
                const completed = Number(batch_progress.succeeded_items ?? batch_progress.succeededItems ?? 0);
                const failed = Number(batch_progress.failed_items ?? batch_progress.failedItems ?? 0);
                progress?.({ completed: Math.min(completed, total), failed, total });
                if (status === "succeeded") break;
                if (["partial", "failed", "invalid", "canceled"].includes(status)) throw new Error(`Zep batch ${batch_id} ended with status ${status}`);
                if (Date.now() - started >= this.timeout_ms) throw new Error(`Zep batch polling timed out at ${completed}/${total}`);
                await wait(2_000);
            }
            await this.await_searchable(scope, started);
            return;
        }
        const total = result.pending_ids?.length ?? result.ids.length;
        const started = Date.now();
        while (true) {
            const response = unwrap(await this.api().get(route(this.routes.indexing ?? defaults.indexing!, { scope: this.group(scope), count: total })));
            const completed = array(response).length;
            progress?.({ completed: Math.min(completed, total), failed: 0, total });
            if (completed >= total) return;
            if (Date.now() - started >= this.timeout_ms) throw new Error(`graphiti indexing timed out at ${completed}/${total}`);
            await wait(500);
        }
    }

    async search(query: string, limit: number, scope: benchmark_scope): Promise<search_hit[]> {
        if (this.cloud) {
            return as_hits(await this.api().post(this.routes.search, {
                graph_id: this.group(scope),
                query,
                limit: Math.min(limit, 50),
                scope: "episodes",
                reranker: "cross_encoder",
            }));
        }
        const response = record(unwrap(await this.api().post(this.routes.search, {
            group_ids: [this.group(scope)],
            query,
            max_facts: limit,
        })));
        return as_hits({
            facts: array(response.facts).map((raw) => {
                const item = record(raw);
                return { ...item, metadata: { source_event_id: text(item.name), graphiti: item } };
            }),
        });
    }

    async close(): Promise<void> { }

    private group(scope: benchmark_scope): string {
        return `omb_${scope_key(scope.run_id)}_${scope_key(scope.corpus_id)}`;
    }

    private async await_searchable(scope: benchmark_scope, started: number): Promise<void> {
        const query = this.readiness_queries.get(this.group(scope));
        if (!query) return;
        while (true) {
            const search = record(unwrap(await this.api().post(this.routes.search, {
                graph_id: this.group(scope), query, limit: 1, scope: "episodes", reranker: "cross_encoder",
            })));
            if (array(search.episodes).length) return;
            if (Date.now() - started >= this.timeout_ms) throw new Error("Zep search readiness timed out");
            await wait(1_000);
        }
    }
}
