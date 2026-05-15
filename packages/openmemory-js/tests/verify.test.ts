process.env.OM_EMBEDDINGS = "synthetic";
process.env.OM_EMBEDDING_FALLBACK = "synthetic";
process.env.OM_METADATA_BACKEND = process.env.OM_METADATA_BACKEND || "sqlite";
process.env.OM_VECTOR_BACKEND = process.env.OM_VECTOR_BACKEND || "sqlite";

import { describe, it, expect, beforeAll } from "vitest";
import { Memory } from "../src/core/memory";
import { env } from "../src/core/cfg";
import { all_async, run_async } from "../src/core/db";

const SAMPLES = [
    {
        type: "episodic",
        text: "Yesterday I went to the park at 4:00 PM and saw a dog.",
    },
    {
        type: "emotional",
        text: "I am genuinely thrilled about how this project is shaping up.",
    },
    {
        type: "procedural",
        text: "To deploy: run npm run build, then npm start, then health-check.",
    },
    {
        type: "reflective",
        text: "I learn best when I write things down and revisit them later.",
    },
    { type: "semantic", text: "The capital of France is Paris." },
];

describe("verify: classifier behaviour snapshot", () => {
    const uid = "js_sector_tester_v1";
    let rows: Array<{ text: string; primary_sector: string; vec_dim: number }> =
        [];

    beforeAll(async () => {
        await run_async("DELETE FROM memories WHERE user_id = ?", [uid]);
        const mem = new Memory(uid);
        for (const s of SAMPLES) {
            await mem.add(s.text, { user_id: uid });
        }
        const raw: any[] = await all_async(
            "SELECT content, primary_sector, mean_vec FROM memories WHERE user_id = ? ORDER BY created_at",
            [uid],
        );
        rows = raw.map((r) => ({
            text: r.content,
            primary_sector: r.primary_sector,
            vec_dim: r.mean_vec ? r.mean_vec.length / 4 : 0,
        }));
    });

    it("matches the classifier sector snapshot", () => {
        // Snapshot freezes current classifier behaviour. If this fails, the
        // classifier changed: review the diff and update with `vitest -u`
        // only if the new labels are intentional.
        expect(
            rows.map((r) => ({ text: r.text, sector: r.primary_sector })),
        ).toMatchSnapshot();
    });

    it("emits the configured vector dimension for every sample", () => {
        for (const r of rows) {
            expect(r.vec_dim).toBe(env.vec_dim);
        }
    });
});
