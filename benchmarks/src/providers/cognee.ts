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
 *  file  : benchmarks/src/providers/cognee.ts
 *  usage : supports LongMemory benchmark cognee
 */

import { http_client } from "./http";
import { array, as_hits, attributed_text, ignore_missing, record, route, scope_key, text, unwrap } from "./shared";
import type { benchmark_event, benchmark_provider, benchmark_scope, ingest_result, provider_config, route_config, search_hit } from "../types";
import { benchmark_source_ref } from "../source_ref";

const defaults: route_config = {
    health: "/health",
    reset: "/api/v1/datasets/:id",
    ingest: "/api/v1/add",
    search: "/api/v1/search",
    indexing: "/api/v1/cognify",
};
const add_batch_size = 20;
const cognify_data_per_batch = 4;

export class cognee_provider implements benchmark_provider {
    readonly name = "cognee" as const;
    readonly display_name = "cognee self-hosted";
    private client: http_client | null = null;
    private routes = defaults;
    private datasets_route = "/api/v1/datasets";
    private readonly source_refs_by_file = new Map<string, string[]>();

    async initialize(config: provider_config): Promise<void> {
        this.routes = { ...defaults, ...config.routes };
        this.datasets_route = config.profile === "v1" ? "/v1/datasets" : "/api/v1/datasets";
        this.client = new http_client({ ...config, auth_header: "x-api-key", auth_prefix: "" });
    }

    private api(): http_client {
        if (!this.client) throw new Error("cognee is not initialized");
        return this.client;
    }

    async health(): Promise<void> {
        await this.api().get(this.routes.health);
    }

    async reset(scope: benchmark_scope): Promise<void> {
        this.source_refs_by_file.clear();
        const datasets = array(unwrap(await this.api().get(this.datasets_route)));
        const found = datasets.map(record).find((item) => text(item.name) === this.dataset(scope));
        const id = found ? text(found.id) : "";
        if (id) await ignore_missing(() => this.api().delete(route(this.routes.reset, { id })));
    }

    async ingest(events: benchmark_event[], scope: benchmark_scope): Promise<ingest_result> {
        const documents = this.session_groups(events).map((group) => {
            const content = group.map((event) => `[${new Date(event.timestamp).toISOString()}] ${attributed_text(event)}`).join("\n");
            const file_ref = benchmark_source_ref({ id: group.map((event) => event.id).join("\0"), text: content });
            const source_refs = group.map(benchmark_source_ref);
            this.source_refs_by_file.set(file_ref, source_refs);
            return { content, file_ref };
        });
        for (let start = 0; start < documents.length; start += add_batch_size) {
            const form = new FormData();
            for (const document of documents.slice(start, start + add_batch_size)) {
                form.append("data", new Blob([document.content], { type: "text/plain" }), `${document.file_ref}.txt`);
            }
            form.append("datasetName", this.dataset(scope));
            form.append("run_in_background", "false");
            await this.api().request(this.routes.ingest, { method: "POST", body: form });
        }
        const ids = events.map((event) => event.id);
        return { ids, pending_ids: ids };
    }

    async await_indexing(result: ingest_result, scope: benchmark_scope, progress?: (value: { completed: number; failed: number; total: number }) => void): Promise<void> {
        const total = result.pending_ids?.length ?? result.ids.length;
        progress?.({ completed: 0, failed: 0, total });
        await this.api().post(this.routes.indexing ?? defaults.indexing!, {
            datasets: [this.dataset(scope)],
            run_in_background: false,
            data_per_batch: cognify_data_per_batch,
        });
        progress?.({ completed: total, failed: 0, total });
    }

    async search(query: string, limit: number, scope: benchmark_scope): Promise<search_hit[]> {
        const hits = as_hits(await this.api().post(this.routes.search, {
            search_type: "CHUNKS",
            datasets: [this.dataset(scope)],
            query,
            top_k: limit,
            only_context: false,
            include_references: true,
        }));
        return hits.map((hit) => {
            const raw = record(hit.metadata.raw);
            const file_ref = text(raw.document_name, raw.documentName).replace(/\.txt$/i, "");
            const refs = this.source_refs_by_file.get(file_ref);
            return refs ? { ...hit, metadata: { ...hit.metadata, source_refs: refs } } : hit;
        });
    }

    async close(): Promise<void> { }

    private dataset(scope: benchmark_scope): string {
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
