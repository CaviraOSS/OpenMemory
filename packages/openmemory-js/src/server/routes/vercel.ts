import { hsg_query, add_hsg_memory } from "../../memory/hsg";
import { j } from "../../utils";

export function vercel(app: any) {

    app.post("/query", async (req: any, res: any) => {
        try {
            const b = req.body || {};
            const query: string = String(b.query || "").slice(0, 4000);
            const user_id: string | undefined = b.user_id || req.query.user_id;
            const k: number = Math.max(1, Math.min(32, Number(b.k) || 8));
            if (!query) return res.status(400).json({ err: "query" });

            const startTime: number | undefined = b.startTime ? Number(b.startTime) : undefined;
            const endTime: number | undefined = b.endTime ? Number(b.endTime) : undefined;
            const matches = await hsg_query(query, k, { user_id, startTime, endTime });
            const lines = matches.map((m: any) => `- (${(m.score ?? 0).toFixed(2)}) ${m.content}`);
            const result = lines.join("\n");

            res.json({
                query,
                user_id: user_id || null,
                k,
                result,
                matches: matches.map((m: any) => ({
                    id: m.id,
                    content: m.content,
                    score: m.score,
                    sectors: m.sectors,
                    primary_sector: m.primary_sector,
                    last_seen_at: m.last_seen_at,
                })),
            });
        } catch (e: any) {
            res.status(500).json({ err: "internal", msg: e?.message || String(e) });
        }
    });


    app.post("/memories", async (req: any, res: any) => {
        try {
            const b = req.body || {};
            const content: string = String(b.content || "").trim();
            const user_id: string | undefined = b.user_id || req.query.user_id;
            const tags: string[] = Array.isArray(b.tags) ? b.tags : [];
            const metadata: any = b.metadata || undefined;
            if (!content) return res.status(400).json({ err: "content" });

            const r = await add_hsg_memory(content, j(tags), metadata, user_id);
            res.json(r);
        } catch (e: any) {
            res.status(500).json({ err: "internal", msg: e?.message || String(e) });
        }
    });
}
