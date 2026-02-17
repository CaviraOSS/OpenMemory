/**
 * Background Task Observability Module (C3)
 *
 * Provides structured logging and metrics for background tasks:
 * - Decay process
 * - Prune weak waypoints
 * - Reflection/consolidation
 * - User summary updates
 *
 * Metrics are exposed via /api/system/stats and /metrics endpoints.
 */

import { record_task_success, record_task_failure } from "./metrics";

export interface TaskMetrics {
    task_name: string;
    last_run_at: number | null;
    last_success_at: number | null;
    last_failure_at: number | null;
    run_count: number;
    success_count: number;
    failure_count: number;
    last_duration_ms: number | null;
    last_error: string | null;
    last_result: Record<string, unknown> | null;
}

export interface BackgroundTaskResult {
    success: boolean;
    duration_ms: number;
    result?: Record<string, unknown>;
    error?: string;
}

// In-memory metrics store (process lifetime)
const metrics_store: Map<string, TaskMetrics> = new Map();

// Task names as constants for consistency
export const TASK_NAMES = {
    DECAY: "decay",
    PRUNE: "prune_waypoints",
    REFLECT: "reflect",
    USER_SUMMARY: "user_summary",
} as const;

type TaskName = (typeof TASK_NAMES)[keyof typeof TASK_NAMES];

/**
 * Get or initialise metrics for a task
 */
function get_task_metrics(task_name: string): TaskMetrics {
    if (!metrics_store.has(task_name)) {
        metrics_store.set(task_name, {
            task_name,
            last_run_at: null,
            last_success_at: null,
            last_failure_at: null,
            run_count: 0,
            success_count: 0,
            failure_count: 0,
            last_duration_ms: null,
            last_error: null,
            last_result: null,
        });
    }
    return metrics_store.get(task_name)!;
}

/**
 * Log structured output for background task execution
 */
function log_task(
    task_name: string,
    level: "info" | "error" | "warn",
    message: string,
    data?: Record<string, unknown>
): void {
    const timestamp = new Date().toISOString();
    const log_entry = {
        timestamp,
        task: task_name,
        level,
        message,
        ...data,
    };

    const log_fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    log_fn(`[TASK:${task_name.toUpperCase()}] ${message}`, data ? JSON.stringify(data) : "");
}

/**
 * Record task start
 */
export function task_start(task_name: TaskName): number {
    log_task(task_name, "info", "Starting");
    return Date.now();
}

/**
 * Record task success
 */
export function task_success(
    task_name: TaskName,
    start_time: number,
    result?: Record<string, unknown>
): void {
    const duration_ms = Date.now() - start_time;
    const metrics = get_task_metrics(task_name);

    metrics.last_run_at = Date.now();
    metrics.last_success_at = Date.now();
    metrics.run_count++;
    metrics.success_count++;
    metrics.last_duration_ms = duration_ms;
    metrics.last_error = null;
    metrics.last_result = result || null;

    // Update Prometheus metrics
    record_task_success(task_name, duration_ms);

    log_task(task_name, "info", "Completed successfully", {
        duration_ms,
        ...result,
    });
}

/**
 * Record task failure
 */
export function task_failure(
    task_name: TaskName,
    start_time: number,
    error: unknown
): void {
    const duration_ms = Date.now() - start_time;
    const metrics = get_task_metrics(task_name);
    const error_message = error instanceof Error ? error.message : String(error);

    metrics.last_run_at = Date.now();
    metrics.last_failure_at = Date.now();
    metrics.run_count++;
    metrics.failure_count++;
    metrics.last_duration_ms = duration_ms;
    metrics.last_error = error_message;
    metrics.last_result = null;

    // Update Prometheus metrics
    record_task_failure(task_name, duration_ms);

    log_task(task_name, "error", "Failed", {
        duration_ms,
        error: error_message,
    });
}

/**
 * Wrap an async task function with observability
 */
export function with_observability<T extends Record<string, unknown>>(
    task_name: TaskName,
    fn: () => Promise<T>
): () => Promise<BackgroundTaskResult> {
    return async () => {
        const start_time = task_start(task_name);
        try {
            const result = await fn();
            task_success(task_name, start_time, result);
            return {
                success: true,
                duration_ms: Date.now() - start_time,
                result,
            };
        } catch (error) {
            task_failure(task_name, start_time, error);
            return {
                success: false,
                duration_ms: Date.now() - start_time,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    };
}

/**
 * Get metrics for all tracked tasks
 */
export function get_all_task_metrics(): TaskMetrics[] {
    // Ensure all known tasks have entries
    for (const name of Object.values(TASK_NAMES)) {
        get_task_metrics(name);
    }
    return Array.from(metrics_store.values());
}

/**
 * Get metrics for a specific task
 */
export function get_task_metrics_by_name(task_name: string): TaskMetrics | null {
    return metrics_store.get(task_name) || null;
}

/**
 * Get summary statistics across all tasks
 */
export function get_task_summary(): {
    total_runs: number;
    total_successes: number;
    total_failures: number;
    failure_rate: number;
    tasks_with_recent_failures: string[];
} {
    let total_runs = 0;
    let total_successes = 0;
    let total_failures = 0;
    const tasks_with_recent_failures: string[] = [];
    const one_hour_ago = Date.now() - 60 * 60 * 1000;

    for (const metrics of metrics_store.values()) {
        total_runs += metrics.run_count;
        total_successes += metrics.success_count;
        total_failures += metrics.failure_count;

        if (metrics.last_failure_at && metrics.last_failure_at > one_hour_ago) {
            tasks_with_recent_failures.push(metrics.task_name);
        }
    }

    return {
        total_runs,
        total_successes,
        total_failures,
        failure_rate: total_runs > 0 ? total_failures / total_runs : 0,
        tasks_with_recent_failures,
    };
}
