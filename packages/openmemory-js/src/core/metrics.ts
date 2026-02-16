/**
 * Prometheus Metrics Module
 *
 * Exposes metrics for HTTP requests, memory operations, background tasks,
 * and system information. Uses prom-client with a custom registry.
 */

import * as client from "prom-client";
import { env, tier } from "./cfg";

// Create a custom registry to avoid global state pollution
export const registry = new client.Registry();

// Collect default Node.js metrics with custom prefix
client.collectDefaultMetrics({
    register: registry,
    prefix: "openmemory_nodejs_",
});

// ─────────────────────────────────────────────────────────────────────────────
// HTTP Request Metrics
// ─────────────────────────────────────────────────────────────────────────────

export const http_requests_total = new client.Counter({
    name: "openmemory_http_requests_total",
    help: "Total number of HTTP requests",
    labelNames: ["method", "path", "status_code"] as const,
    registers: [registry],
});

export const http_request_duration_seconds = new client.Histogram({
    name: "openmemory_http_request_duration_seconds",
    help: "HTTP request duration in seconds",
    labelNames: ["method", "path"] as const,
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [registry],
});

// ─────────────────────────────────────────────────────────────────────────────
// Memory Metrics (populated by /metrics route)
// ─────────────────────────────────────────────────────────────────────────────

export const memories_total = new client.Gauge({
    name: "openmemory_memories_total",
    help: "Total number of memories",
    labelNames: ["sector"] as const,
    registers: [registry],
});

export const salience_stats = new client.Gauge({
    name: "openmemory_salience",
    help: "Salience statistics",
    labelNames: ["stat", "sector"] as const,
    registers: [registry],
});

export const database_size_bytes = new client.Gauge({
    name: "openmemory_database_size_bytes",
    help: "Database size in bytes",
    registers: [registry],
});

// ─────────────────────────────────────────────────────────────────────────────
// Background Task Metrics
// ─────────────────────────────────────────────────────────────────────────────

export const background_task_runs_total = new client.Counter({
    name: "openmemory_background_task_runs_total",
    help: "Total number of background task runs",
    labelNames: ["task_name", "status"] as const,
    registers: [registry],
});

export const background_task_last_run_timestamp = new client.Gauge({
    name: "openmemory_background_task_last_run_timestamp",
    help: "Unix timestamp of last background task run",
    labelNames: ["task_name"] as const,
    registers: [registry],
});

export const background_task_duration_seconds = new client.Histogram({
    name: "openmemory_background_task_duration_seconds",
    help: "Background task duration in seconds",
    labelNames: ["task_name"] as const,
    buckets: [0.1, 0.5, 1, 2.5, 5, 10, 30, 60, 120],
    registers: [registry],
});

// ─────────────────────────────────────────────────────────────────────────────
// Embedding Metrics
// ─────────────────────────────────────────────────────────────────────────────

export const embedding_requests_total = new client.Counter({
    name: "openmemory_embedding_requests_total",
    help: "Total number of embedding requests",
    labelNames: ["provider", "status"] as const,
    registers: [registry],
});

export const embedding_duration_seconds = new client.Histogram({
    name: "openmemory_embedding_duration_seconds",
    help: "Embedding request duration in seconds",
    labelNames: ["provider"] as const,
    buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [registry],
});

// ─────────────────────────────────────────────────────────────────────────────
// Vector Storage Metrics (populated by /metrics route)
// ─────────────────────────────────────────────────────────────────────────────

export const vectors_total = new client.Gauge({
    name: "openmemory_vectors_total",
    help: "Total number of vectors stored",
    labelNames: ["sector"] as const,
    registers: [registry],
});

export const vector_dimensions = new client.Gauge({
    name: "openmemory_vector_dimensions",
    help: "Configured vector dimensions",
    registers: [registry],
});

export const vector_index_size_bytes = new client.Gauge({
    name: "openmemory_vector_index_size_bytes",
    help: "Size of vector index in bytes",
    registers: [registry],
});

export const embed_logs_total = new client.Gauge({
    name: "openmemory_embed_logs_total",
    help: "Total embedding log entries by status",
    labelNames: ["status"] as const,
    registers: [registry],
});

// ─────────────────────────────────────────────────────────────────────────────
// Info Metric
// ─────────────────────────────────────────────────────────────────────────────

export const info_gauge = new client.Gauge({
    name: "openmemory_info",
    help: "OpenMemory instance information",
    labelNames: ["version", "tier", "embedding_provider", "metadata_backend", "vector_backend"] as const,
    registers: [registry],
});

// Set info gauge on module load
info_gauge.set(
    {
        version: "1.3.3",
        tier: tier,
        embedding_provider: env.emb_kind,
        metadata_backend: env.metadata_backend,
        vector_backend: env.vector_backend,
    },
    1
);

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalise request path for metrics (replace UUIDs with :id)
 */
export function normalise_path(path: string): string {
    // Replace UUID patterns with :id
    return path
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
        // Replace numeric IDs with :id
        .replace(/\/\d+(?=\/|$)/g, "/:id")
        // Normalise trailing slashes
        .replace(/\/+$/, "") || "/";
}

/**
 * Record a successful background task run
 */
export function record_task_success(task_name: string, duration_ms: number): void {
    background_task_runs_total.inc({ task_name, status: "success" });
    background_task_last_run_timestamp.set({ task_name }, Date.now() / 1000);
    background_task_duration_seconds.observe({ task_name }, duration_ms / 1000);
}

/**
 * Record a failed background task run
 */
export function record_task_failure(task_name: string, duration_ms: number): void {
    background_task_runs_total.inc({ task_name, status: "failure" });
    background_task_last_run_timestamp.set({ task_name }, Date.now() / 1000);
    background_task_duration_seconds.observe({ task_name }, duration_ms / 1000);
}

/**
 * Record an embedding request
 */
export function record_embedding(provider: string, success: boolean, duration_ms: number): void {
    embedding_requests_total.inc({ provider, status: success ? "success" : "failure" });
    if (success) {
        embedding_duration_seconds.observe({ provider }, duration_ms / 1000);
    }
}
