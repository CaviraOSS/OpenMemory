import { all_async, memories_table } from "../../database/connection";
import { sector_configs } from "../../retention/hsg";
import { getEmbeddingInfo } from "../../retention/embed";
import { tier, env } from "../../configuration/index";

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

export function sys(app: any) {
  app.get("/health", async (_req: any, res: any) => {
    res.json({
      ok: true,
      version: "2.0-hsg-tiered",
      embedding: getEmbeddingInfo(),
      tier,
      dim: env.vec_dim,
      cache: env.cache_segments,
      expected: TIER_BENEFITS[tier],
    });
  });

  app.get("/sectors", async (_req: any, res: any) => {
    try {
      const stats = await all_async(`
        select primary_sector as sector, count(*) as count, avg(salience) as avg_salience
        from ${memories_table}
        group by primary_sector
      `);
      res.json({
        sectors: Object.keys(sector_configs),
        configs: sector_configs,
        stats,
      });
    } catch {
      res.status(500).json({ err: "internal" });
    }
  });
}
