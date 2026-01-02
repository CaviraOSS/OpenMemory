"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lg = lg;
const graph_1 = require("../../ai/graph");
function lg(app) {
    app.get("/lgm/config", (_req, res) => {
        res.json((0, graph_1.get_lg_cfg)());
    });
    app.post("/lgm/store", async (req, res) => {
        try {
            const r = await (0, graph_1.store_node_mem)(req.body);
            res.json(r);
        }
        catch (e) {
            console.error("[LGM] store error:", e);
            res.status(400).json({
                err: "lgm_store_failed",
                message: e.message,
            });
        }
    });
    app.post("/lgm/retrieve", async (req, res) => {
        try {
            const r = await (0, graph_1.retrieve_node_mems)(req.body);
            res.json(r);
        }
        catch (e) {
            console.error("[LGM] retrieve error:", e);
            res.status(400).json({
                err: "lgm_retrieve_failed",
                message: e.message,
            });
        }
    });
    app.post("/lgm/context", async (req, res) => {
        try {
            const r = await (0, graph_1.get_graph_ctx)(req.body);
            res.json(r);
        }
        catch (e) {
            console.error("[LGM] context error:", e);
            res.status(400).json({
                err: "lgm_context_failed",
                message: e.message,
            });
        }
    });
    app.post("/lgm/reflection", async (req, res) => {
        try {
            const r = await (0, graph_1.create_refl)(req.body);
            res.json(r);
        }
        catch (e) {
            console.error("[LGM] reflection error:", e);
            res.status(400).json({
                err: "lgm_reflection_failed",
                message: e.message,
            });
        }
    });
}
