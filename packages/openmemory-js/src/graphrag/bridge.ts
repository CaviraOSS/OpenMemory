import { env } from "../core/cfg";

export type GraphRagDocument = {
    id: string;
    content: string;
    metadata?: Record<string, unknown>;
    user_id?: string | null;
    project_id?: string | null;
    finalize?: boolean;
};

export type GraphRagQuery = {
    query: string;
    k?: number;
    user_id?: string | null;
    project_id?: string | null;
    return_context?: boolean;
};

export type GraphRagDelete = {
    id: string;
    finalize?: boolean;
};

export type GraphRagBridgeResult = {
    enabled: boolean;
    ok: boolean;
    skipped?: boolean;
    reason?: string;
    data?: unknown;
    error?: string;
};

const baseUrl = () => env.graphrag_url.replace(/\/+$/, "");

const disabled = (reason = "OM_GRAPHRAG_ENABLED is not true"): GraphRagBridgeResult => ({
    enabled: false,
    ok: false,
    skipped: true,
    reason,
});

const writeDisabled = (): GraphRagBridgeResult => ({
    enabled: env.graphrag_enabled,
    ok: false,
    skipped: true,
    reason: "OM_GRAPHRAG_WRITE_ENABLED is not true",
});

const unauthWriteDisabled = (): GraphRagBridgeResult => ({
    enabled: env.graphrag_enabled,
    ok: false,
    skipped: true,
    reason: "OM_API_KEY is required for GraphRAG writes unless OM_GRAPHRAG_ALLOW_UNAUTH_WRITE is true",
});

const globalQueryDisabled = (): GraphRagBridgeResult => ({
    enabled: env.graphrag_enabled,
    ok: false,
    skipped: true,
    reason: "Global GraphRAG queries are disabled until OM_GRAPHRAG_ALLOW_GLOBAL_QUERY is true",
});

const canWrite = (): GraphRagBridgeResult | null => {
    if (!env.graphrag_write_enabled) return writeDisabled();
    if (!env.api_key && !env.graphrag_allow_unauth_write) return unauthWriteDisabled();
    return null;
};

function bridgeSaysNotOk(data: unknown): GraphRagBridgeResult | null {
    if (!data || typeof data !== "object") return null;
    const payload = data as { ok?: unknown; error?: unknown; detail?: unknown };
    if (payload.ok !== false) return null;
    const error = payload.error || payload.detail || "GraphRAG bridge returned ok=false";
    return { enabled: true, ok: false, error: String(error), data };
}

async function requestBridge(path: string, init?: RequestInit): Promise<GraphRagBridgeResult> {
    if (!env.graphrag_enabled) return disabled();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.graphrag_timeout_ms);

    try {
        const response = await fetch(`${baseUrl()}${path}`, {
            ...init,
            signal: controller.signal,
            headers: {
                "content-type": "application/json",
                ...(env.graphrag_bridge_api_key ? { "x-graph-api-key": env.graphrag_bridge_api_key } : {}),
                ...(init?.headers || {}),
            },
        });

        const text = await response.text();
        let data: unknown = null;
        if (text) {
            try {
                data = JSON.parse(text);
            } catch {
                data = { text };
            }
        }

        if (!response.ok) {
            return {
                enabled: true,
                ok: false,
                error: `GraphRAG bridge HTTP ${response.status}`,
                data,
            };
        }

        const bridgeFailure = bridgeSaysNotOk(data);
        if (bridgeFailure) return bridgeFailure;

        return { enabled: true, ok: true, data };
    } catch (error: any) {
        return {
            enabled: true,
            ok: false,
            error: error?.name === "AbortError" ? "GraphRAG bridge timeout" : String(error?.message || error),
        };
    } finally {
        clearTimeout(timeout);
    }
}

export async function getGraphRagStatus(): Promise<GraphRagBridgeResult> {
    return requestBridge("/health", { method: "GET" });
}

export async function queryGraphRag(query: GraphRagQuery): Promise<GraphRagBridgeResult> {
    if (!query.query?.trim()) {
        return { enabled: env.graphrag_enabled, ok: false, error: "query is required" };
    }
    const scoped = Boolean(query.user_id || query.project_id);
    if (!scoped && !env.graphrag_allow_global_query) return globalQueryDisabled();

    return requestBridge("/query", {
        method: "POST",
        body: JSON.stringify({
            query: query.query,
            k: query.k,
            user_id: query.user_id || undefined,
            project_id: query.project_id || undefined,
            return_context: query.return_context ?? true,
        }),
    });
}

export async function syncGraphRagDocument(doc: GraphRagDocument): Promise<GraphRagBridgeResult> {
    const writeGate = canWrite();
    if (writeGate) return writeGate;

    if (!doc.id?.trim()) {
        return { enabled: env.graphrag_enabled, ok: false, error: "document id is required" };
    }
    if (!doc.content?.trim()) {
        return { enabled: env.graphrag_enabled, ok: false, error: "document content is required" };
    }

    return requestBridge("/documents/upsert", {
        method: "POST",
        body: JSON.stringify({
            document_id: doc.id,
            content: doc.content,
            metadata: doc.metadata || {},
            user_id: doc.user_id || undefined,
            project_id: doc.project_id || undefined,
            finalize: doc.finalize ?? false,
        }),
    });
}

export async function deleteGraphRagDocument(doc: GraphRagDelete): Promise<GraphRagBridgeResult> {
    const writeGate = canWrite();
    if (writeGate) return writeGate;

    if (!doc.id?.trim()) {
        return { enabled: env.graphrag_enabled, ok: false, error: "document id is required" };
    }

    return requestBridge("/documents/delete", {
        method: "POST",
        body: JSON.stringify({
            document_id: doc.id,
            finalize: doc.finalize ?? false,
        }),
    });
}

export function maybeSyncGraphRagDocument(doc: GraphRagDocument): void {
    if (!env.graphrag_enabled || !env.graphrag_sync_on_add || canWrite()) return;

    syncGraphRagDocument(doc).then((result) => {
        if (!result.ok) {
            console.error("[GraphRAG] sync failed:", result.error || result.reason || result.data);
        }
    }).catch((error) => {
        console.error("[GraphRAG] sync failed:", error);
    });
}

export function maybeDeleteGraphRagDocument(doc: GraphRagDelete): void {
    if (!env.graphrag_enabled || !env.graphrag_sync_on_add || canWrite()) return;

    deleteGraphRagDocument(doc).then((result) => {
        if (!result.ok) {
            console.error("[GraphRAG] delete failed:", result.error || result.reason || result.data);
        }
    }).catch((error) => {
        console.error("[GraphRAG] delete failed:", error);
    });
}
