"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sys = sys;
const db_1 = require("../../core/db");
const hsg_1 = require("../../memory/hsg");
const embed_1 = require("../../memory/embed");
const cfg_1 = require("../../core/cfg");
const TIER_BENEFITS = {
    hybrid: {
        recall: 98,
        qps: "700-800",
        ram: "0.5gb/10k",
        use: "For high accuracy",
    },
    fast: {
        recall: 70,
        qps: "700-850",
        ram: "0.6GB/10k",
        use: "Local apps, extensions",
    },
    smart: {
        recall: 85,
        qps: "500-600",
        ram: "0.9GB/10k",
        use: "Production servers",
    },
    deep: {
        recall: 94,
        qps: "350-400",
        ram: "1.6GB/10k",
        use: "Cloud, high-accuracy",
    },
};
function sys(app) {
    app.get("/health", async (incoming_http_request, outgoing_http_response) => {
        outgoing_http_response.json({
            ok: true,
            version: "2.0-hsg-tiered",
            embedding: (0, embed_1.getEmbeddingInfo)(),
            tier: cfg_1.tier,
            dim: cfg_1.env.vec_dim,
            cache: cfg_1.env.cache_segments,
            expected: TIER_BENEFITS[cfg_1.tier],
        });
    });
    app.get("/sectors", async (incoming_http_request, outgoing_http_response) => {
        try {
            const database_sector_statistics_rows = await (0, db_1.all_async)(`
                select primary_sector as sector, count(*) as count, avg(salience) as avg_salience 
                from memories 
                group by primary_sector
            `);
            outgoing_http_response.json({
                sectors: Object.keys(hsg_1.sector_configs),
                configs: hsg_1.sector_configs,
                stats: database_sector_statistics_rows,
            });
        }
        catch (unexpected_error_fetching_sectors) {
            outgoing_http_response.status(500).json({ err: "internal" });
        }
    });
}
