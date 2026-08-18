import { createMemory, type open_memory } from "../../../src/core/create_memory.js";
import { memory_evidence_text } from "../../../src/core/recall/evidence.js";
import { strict_recall_tokens } from "../../../src/core/recall/recall_text.js";
import { create_embedding_environment } from "../../../src/core/embeddings/environment.js";
import { benchmark_defaults } from "../config";
import { benchmark_source_ref } from "../source_ref";
import type { benchmark_event, benchmark_provider, benchmark_scope, ingest_result, provider_config, search_hit } from "../types";
import { provider_metadata, scope_key, text } from "./shared";

export class openmemory_provider implements benchmark_provider {
    readonly name = "openmemory" as const;
    readonly display_name = "openmemory";
    private memory: open_memory | null = null;
    private world_id: string | null = null;
    private embeddings: ReturnType<typeof create_embedding_environment> = null;
    private embedding_batch_size = 16;
    private embedding_fallback: string | null = null;

    async initialize(config: provider_config): Promise<void> {
        this.embedding_fallback = null;
        this.embeddings = config.profile === "semantic" ? create_embedding_environment(process.env, {
            logger: (message) => { this.embedding_fallback = message; },
        }) : null;
        const provider = this.embeddings?.config.provider;
        const batch_size = config.embedding_batch_size ?? (provider === "ollama" ? 128 : provider === "gemini" ? 100 : 16);
        if (!Number.isInteger(batch_size) || batch_size <= 0) throw new Error("OpenMemory embedding batch size must be a positive integer");
        this.embedding_batch_size = batch_size;
        await this.make_memory();
    }

    async health(): Promise<void> {
        if (!this.memory) throw new Error("openmemory is not initialized");
        const status = this.memory.status();
        if (!status.ready) throw new Error("openmemory is not ready");
    }

    async reset(_scope: benchmark_scope): Promise<void> {
        await this.memory?.close();
        await this.make_memory();
    }

    async ingest(events: benchmark_event[], scope: benchmark_scope): Promise<ingest_result> {
        if (!this.memory) throw new Error("openmemory is not initialized");
        const ids: string[] = [];
        const world = `benchmark-${scope_key(scope.run_id)}-${scope_key(scope.corpus_id)}`;
        const vectors: number[][] = [];
        const embed_many = this.embeddings?.embedding_provider.embed_many?.bind(this.embeddings.embedding_provider);
        if (embed_many) {
            for (let index = 0; index < events.length; index += this.embedding_batch_size) {
                vectors.push(...await embed_many(events.slice(index, index + this.embedding_batch_size).map((event) => event.text), { purpose: "document" }));
                this.assert_semantic_provider();
            }
        }
        for (let index = 0; index < events.length; index++) {
            const event = events[index];
            const result = await this.memory.ingest({
                user_id: scope.user_id,
                text: event.text,
                speaker: text(event.metadata.speaker, event.metadata.role) || undefined,
                conversation_id: `${scope.corpus_id}:${text(event.metadata.session, event.metadata.session_id) || "default"}`,
                ...(vectors[index] ? { vector: vectors[index] } : {}),
                at: event.timestamp,
                observed_at: event.timestamp,
                world,
                metadata: { ...provider_metadata(event.metadata), source_ref: benchmark_source_ref(event), benchmark_run_id: scope.run_id },
            });
            this.assert_semantic_provider();
            ids.push(result.node.id);
            this.world_id = result.node.world.world_id;
        }
        return { ids };
    }

    async await_indexing(result: ingest_result, _scope: benchmark_scope, progress?: (value: { completed: number; failed: number; total: number }) => void): Promise<void> {
        progress?.({ completed: result.ids.length, failed: 0, total: result.ids.length });
    }

    async search(query: string, limit: number, scope: benchmark_scope): Promise<search_hit[]> {
        if (!this.memory || !this.world_id) throw new Error("openmemory case has not been ingested");
        const result = await this.memory.recall({
            text: query,
            mode: "associative",
            world_id: this.world_id,
            ...(scope.question_time !== undefined ? { now: scope.question_time, at: scope.question_time } : {}),
            k: Math.max(limit * 4, 20),
            token_budget: Number.POSITIVE_INFINITY,
        });
        this.assert_semantic_provider();
        const included = new Set("context" in result ? result.context.items.map((node) => node.id) : []);
        const items = "items" in result ? result.items.filter((item) => included.has(item.node.id)) : [];
        const query_terms = strict_recall_tokens(query);
        return items.slice(0, limit).map((item) => ({
            id: item.node.id,
            text: memory_evidence_text(item.node, { query_terms }),
            score: "score" in item ? item.score : "grounding_score" in item ? item.grounding_score : 0,
            metadata: { ...item.node.metadata, timestamp: new Date(item.node.temporal.observed_at).toISOString(), raw: item },
        }));
    }

    async close(): Promise<void> {
        await this.memory?.close();
        this.memory = null;
        this.world_id = null;
    }

    private async make_memory(): Promise<void> {
        this.memory = createMemory({
            store: "memory",
            max_context_tokens: benchmark_defaults.context_token_budget,
            ...(this.embeddings ? {
                embedding_provider: this.embeddings.embedding_provider,
                embedding_dimension: this.embeddings.embedding_dimension,
            } : {}),
        });
        this.world_id = null;
    }

    private assert_semantic_provider(): void {
        if (this.embedding_fallback) throw new Error(`OpenMemory semantic embedding fallback is not valid for official evaluation: ${this.embedding_fallback}`);
    }
}
