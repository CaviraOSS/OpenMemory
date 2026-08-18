import { http_client } from "./http";
import { array, as_hits, ignore_missing, provider_metadata, record, route, scope_key, text, unwrap, wait } from "./shared";
import type { benchmark_event, benchmark_provider, benchmark_scope, ingest_result, provider_config, route_config, search_hit } from "../types";
import { benchmark_source_ref } from "../source_ref";

const defaults: route_config = {
    health: "/api/health",
    reset: "/memories",
    ingest: "/memories",
    search: "/search",
};

const cloud_defaults: route_config = {
    health: "/v1/ping/",
    reset: "/v1/memories/",
    ingest: "/v3/memories/add/",
    search: "/v3/memories/search/",
    indexing: "/v1/event/:id/",
};

export class mem0_provider implements benchmark_provider {
    readonly name = "mem0" as const;
    readonly display_name = "mem0 api";
    private client: http_client | null = null;
    private routes = defaults;
    private cloud = true;
    private timeout_ms = 120_000;

    async initialize(config: provider_config): Promise<void> {
        this.cloud = config.profile !== "oss" && config.profile !== "local";
        if (this.cloud && !config.api_key) throw new Error("Mem0 Platform requires MEM0_API_KEY or BENCH_MEM0_API_KEY");
        this.routes = { ...(this.cloud ? cloud_defaults : defaults), ...config.routes };
        this.timeout_ms = config.timeout_ms ?? 120_000;
        this.client = new http_client({
            ...config,
            auth_header: this.cloud ? "authorization" : "x-api-key",
            auth_prefix: this.cloud ? "Token " : "",
        });
    }

    private api(): http_client {
        if (!this.client) throw new Error("mem0 is not initialized");
        return this.client;
    }

    async health(): Promise<void> {
        await this.api().get(this.routes.health);
    }

    async reset(scope: benchmark_scope): Promise<void> {
        await ignore_missing(() => this.api().delete(`${this.routes.reset}?user_id=${encodeURIComponent(this.user(scope))}`));
    }

    async ingest(events: benchmark_event[], scope: benchmark_scope): Promise<ingest_result> {
        const ids: string[] = [];
        const groups = this.cloud ? this.session_groups(events) : events.map((event) => [event]);
        for (const group of groups) {
            const first = group[0];
            const response = record(unwrap(await this.api().post(this.routes.ingest, {
                messages: group.map((event) => {
                    const configured_role = text(event.metadata.role).toLowerCase();
                    return { role: ["assistant", "system", "user"].includes(configured_role) ? configured_role : "user", content: event.text };
                }),
                user_id: this.user(scope),
                metadata: {
                    ...provider_metadata(first.metadata),
                    source_refs: group.map(benchmark_source_ref),
                    timestamp: new Date(first.timestamp).toISOString(),
                },
            })));
            if (this.cloud) {
                const event_id = text(response.event_id, response.id);
                if (event_id) ids.push(event_id);
            } else {
                for (const raw of array(response.results ?? response.memories)) {
                    const item = record(raw);
                    const id = text(item.id, item.memory_id);
                    if (id) ids.push(id);
                }
            }
        }
        return this.cloud ? { ids, pending_ids: ids } : { ids };
    }

    async await_indexing(result: ingest_result, _scope: benchmark_scope, progress?: (value: { completed: number; failed: number; total: number }) => void): Promise<void> {
        if (this.cloud) {
            const pending = new Set(result.pending_ids ?? result.ids);
            const total = pending.size;
            let completed = 0;
            let failed = 0;
            const started = Date.now();
            while (pending.size) {
                for (const id of [...pending]) {
                    const response = record(unwrap(await this.api().get(route(this.routes.indexing ?? cloud_defaults.indexing!, { id }))));
                    const status = text(response.status).toUpperCase();
                    if (status === "SUCCEEDED") { pending.delete(id); completed++; }
                    else if (status === "FAILED") { pending.delete(id); failed++; }
                }
                progress?.({ completed, failed, total });
                if (!pending.size) break;
                if (Date.now() - started >= this.timeout_ms) throw new Error(`Mem0 event polling timed out with ${pending.size} pending`);
                await wait(500);
            }
            if (failed) throw new Error(`Mem0 failed to process ${failed} event(s)`);
            return;
        }
        progress?.({ completed: result.ids.length, failed: 0, total: result.ids.length });
    }

    async search(query: string, limit: number, scope: benchmark_scope): Promise<search_hit[]> {
        return as_hits(await this.api().post(this.routes.search, {
            query,
            filters: { user_id: this.user(scope) },
            top_k: limit,
            ...(this.cloud ? { threshold: 0, rerank: false } : {}),
        }));
    }

    async close(): Promise<void> { }

    private user(scope: benchmark_scope): string {
        return `omb_${scope_key(scope.run_id)}_${scope_key(scope.corpus_id)}`;
    }

    private session_groups(events: benchmark_event[]): benchmark_event[][] {
        const groups = new Map<string, benchmark_event[]>();
        for (const event of events) {
            const session = text(event.metadata.session, event.metadata.session_id) || "default";
            const group = groups.get(session) ?? [];
            group.push(event);
            groups.set(session, group);
        }
        return [...groups.values()].flatMap((group) => Array.from(
            { length: Math.ceil(group.length / 20) },
            (_, index) => group.slice(index * 20, (index + 1) * 20),
        ));
    }
}
