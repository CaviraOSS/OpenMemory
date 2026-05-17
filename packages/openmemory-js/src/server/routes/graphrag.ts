import { q } from "../../core/db";
import { env } from "../../core/cfg";
import {
    deleteGraphRagDocument,
    getGraphRagStatus,
    queryGraphRag,
    syncGraphRagDocument,
} from "../../graphrag/bridge";
import { p } from "../../utils";

export function graphrag(app: any) {
    app.get("/graphrag/status", async (_req: any, res: any) => {
        const status = await getGraphRagStatus();
        res.status(status.ok || status.skipped ? 200 : 503).json({
            ...status,
            config: {
                enabled: env.graphrag_enabled,
                bridge_url: env.graphrag_url,
                write_enabled: env.graphrag_write_enabled,
                allow_unauth_write: env.graphrag_allow_unauth_write,
                allow_global_query: env.graphrag_allow_global_query,
                allow_unfiltered_scoped_query: env.graphrag_allow_unfiltered_scoped_query,
                bridge_auth_configured: Boolean(env.graphrag_bridge_api_key),
                sync_on_add: env.graphrag_sync_on_add,
                ide_context_enabled: env.graphrag_context_enabled,
            },
        });
    });

    app.post("/graphrag/query", async (req: any, res: any) => {
        const result = await queryGraphRag({
            query: req.body?.query,
            k: req.body?.k || req.body?.limit,
            user_id: req.body?.user_id,
            project_id: req.body?.project_id,
            return_context: req.body?.return_context,
        });
        res.status(result.ok || result.skipped ? 200 : 502).json(result);
    });

    app.post("/graphrag/sync", async (req: any, res: any) => {
        const id = req.body?.id || req.body?.memory_id;
        let content = req.body?.content;
        let metadata = req.body?.metadata || {};
        let user_id = req.body?.user_id;
        let project_id = req.body?.project_id;

        if (id && content) {
            return res.status(400).json({
                ok: false,
                error: "invalid_request",
                message: "id and content are mutually exclusive; use document_id for explicit content sync",
            });
        }

        if (id) {
            const mem = await q.get_mem.get(id);
            if (!mem) {
                return res.status(404).json({ ok: false, error: `memory ${id} not found` });
            }
            if (mem.user_id && user_id !== mem.user_id) {
                return res.status(403).json({
                    ok: false,
                    error: "forbidden",
                    message: "user_id is required and must match the existing memory owner",
                });
            }
            if (mem.project_id && project_id !== mem.project_id) {
                return res.status(403).json({
                    ok: false,
                    error: "forbidden",
                    message: "project_id is required and must match the existing memory project",
                });
            }
            content = mem.content;
            metadata = {
                ...p(mem.meta || "{}"),
                ...metadata,
                openmemory_id: mem.id,
                primary_sector: mem.primary_sector,
            };
            user_id = user_id || mem.user_id;
            project_id = project_id || mem.project_id;
        }

        const result = await syncGraphRagDocument({
            id: id || req.body?.document_id,
            content,
            metadata,
            user_id,
            project_id,
            finalize: req.body?.finalize,
        });
        res.status(result.ok || result.skipped ? 200 : 502).json(result);
    });

    app.post("/graphrag/delete", async (req: any, res: any) => {
        const document_id = req.body?.document_id || req.body?.id || req.body?.memory_id;
        if (!document_id) {
            return res.status(400).json({
                ok: false,
                error: "invalid_request",
                message: "document_id or id is required",
            });
        }

        const result = await deleteGraphRagDocument({
            id: document_id,
            finalize: req.body?.finalize,
        });
        res.status(result.ok || result.skipped ? 200 : 502).json(result);
    });
}
