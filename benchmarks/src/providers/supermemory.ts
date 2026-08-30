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
 *  file  : benchmarks/src/providers/supermemory.ts
 *  usage : supports LongMemory benchmark supermemory
 */

import { http_client } from "./http";
import { as_hits, attributed_text, ignore_missing, provider_metadata, record, route, scope_key, text, unwrap, wait } from "./shared";
import type { benchmark_event, benchmark_provider, benchmark_scope, ingest_result, provider_config, route_config, search_hit } from "../types";
import { benchmark_source_ref } from "../source_ref";

const defaults: route_config = {
    health: "/v3/container-tags/list",
    reset: "/v3/container-tags/:scope",
    ingest: "/v3/documents",
    search: "/v4/search",
    indexing: "/v3/documents/:id",
};

export class supermemory_provider implements benchmark_provider {
    readonly name = "supermemory" as const;
    readonly display_name = "supermemory api";
    private client: http_client | null = null;
    private routes = defaults;
    private timeout_ms = 120_000;

    async initialize(config: provider_config): Promise<void> {
        if (!config.api_key) throw new Error("Supermemory API requires SUPERMEMORY_API_KEY or BENCH_SUPERMEMORY_API_KEY");
        this.routes = { ...defaults, ...config.routes };
        this.timeout_ms = config.timeout_ms ?? 120_000;
        this.client = new http_client(config);
    }

    private api(): http_client {
        if (!this.client) throw new Error("supermemory is not initialized");
        return this.client;
    }

    async health(): Promise<void> {
        await this.api().get(this.routes.health);
    }

    async reset(scope: benchmark_scope): Promise<void> {
        await ignore_missing(() => this.api().delete(route(this.routes.reset, { scope: this.container(scope) })));
    }

    async ingest(events: benchmark_event[], scope: benchmark_scope): Promise<ingest_result> {
        const ids: string[] = [];
        for (const event of events) {
            const response = record(unwrap(await this.api().post(this.routes.ingest, {
                content: attributed_text(event),
                containerTag: this.container(scope),
                metadata: { ...provider_metadata(event.metadata), source_ref: benchmark_source_ref(event), timestamp: new Date(event.timestamp).toISOString() },
            })));
            const id = text(response.id, response.documentId);
            if (id) ids.push(id);
        }
        return { ids, pending_ids: ids };
    }

    async await_indexing(result: ingest_result, _scope: benchmark_scope, progress?: (value: { completed: number; failed: number; total: number }) => void): Promise<void> {
        const pending = new Set(result.pending_ids ?? result.ids);
        const total = pending.size;
        let completed = 0;
        let failed = 0;
        const started = Date.now();
        while (pending.size) {
            for (const id of [...pending]) {
                const item = record(unwrap(await this.api().get(route(this.routes.indexing ?? defaults.indexing!, { id }))));
                const status = text(item.status).toLowerCase();
                if (["done", "completed", "ready"].includes(status)) { pending.delete(id); completed++; }
                else if (["failed", "error"].includes(status)) { pending.delete(id); failed++; }
            }
            progress?.({ completed, failed, total });
            if (!pending.size) break;
            if (Date.now() - started >= this.timeout_ms) throw new Error(`supermemory indexing timed out with ${pending.size} pending`);
            await wait(500);
        }
        if (failed) throw new Error(`supermemory failed to index ${failed} documents`);
    }

    async search(query: string, limit: number, scope: benchmark_scope): Promise<search_hit[]> {
        return as_hits(await this.api().post(this.routes.search, {
            q: query,
            containerTag: this.container(scope),
            searchMode: "hybrid",
            limit,
        }));
    }

    async close(): Promise<void> { }

    private container(scope: benchmark_scope): string {
        return `omb_${scope_key(scope.run_id)}_${scope_key(scope.corpus_id)}`;
    }
}
