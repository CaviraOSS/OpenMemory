import {
    afterAll,
    afterEach,
    beforeAll,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { get_model } from "../src/core/models";

describe("openrouter provider wiring", () => {
    let env: any;
    let embedQueryForAllSectors: any;
    let getEmbeddingInfo: any;
    let getEmbeddingProvider: any;

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    beforeAll(async () => {
        vi.resetModules();
        process.env.OM_EMBEDDINGS = "openrouter";
        process.env.OM_TIER = "deep";
        process.env.OPENROUTER_API_KEY = "sk-or-v1-test";
        process.env.OM_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
        process.env.OM_OPENROUTER_EMBEDDING_MODEL =
            "openai/text-embedding-3-small";
        process.env.OM_EMBED_MODE = "simple";
        const cfg = await import("../src/core/cfg");
        const embed = await import("../src/memory/embed");
        env = cfg.env;
        getEmbeddingInfo = embed.getEmbeddingInfo;
        getEmbeddingProvider = embed.getEmbeddingProvider;
        embedQueryForAllSectors = embed.embedQueryForAllSectors;
    });

    afterAll(() => {
        delete process.env.OM_EMBEDDINGS;
        delete process.env.OM_TIER;
        delete process.env.OPENROUTER_API_KEY;
        delete process.env.OM_OPENROUTER_BASE_URL;
        delete process.env.OM_OPENROUTER_EMBEDDING_MODEL;
        delete process.env.OM_EMBED_MODE;
    });

    it("exposes OpenRouter configuration", () => {
        expect(env.openrouter_key).toBe("sk-or-v1-test");
        expect(env.openrouter_base_url).toBe("https://openrouter.ai/api/v1");
        expect(env.emb_kind).toBe("openrouter");
    });

    it("resolves the OpenRouter default for every sector", () => {
        for (const sector of [
            "episodic",
            "semantic",
            "procedural",
            "emotional",
            "reflective",
        ]) {
            expect(get_model(sector, "openrouter")).toBe(
                "openai/text-embedding-3-small",
            );
        }
    });

    it("honors the model override", () => {
        const previous = process.env.OM_OPENROUTER_EMBEDDING_MODEL;
        process.env.OM_OPENROUTER_EMBEDDING_MODEL = "vendor/custom-embedding";
        try {
            expect(get_model("semantic", "openrouter")).toBe(
                "vendor/custom-embedding",
            );
        } finally {
            process.env.OM_OPENROUTER_EMBEDDING_MODEL = previous;
        }
    });

    it("reports OpenRouter as the active batch-capable provider", () => {
        expect(getEmbeddingProvider()).toBe("openrouter");
        const info = getEmbeddingInfo();
        expect(info.provider).toBe("openrouter");
        expect(info.configured).toBe(true);
        expect(info.base_url).toBe("https://openrouter.ai/api/v1");
        expect(info.models.semantic).toBe("openai/text-embedding-3-small");
        expect(info.batch_support).toBe(true);
    });

    it("batches query embeddings through the OpenRouter endpoint", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                data: [{ embedding: [1, 0] }, { embedding: [0, 1] }],
            }),
        });
        vi.stubGlobal("fetch", fetchMock);

        const result = await embedQueryForAllSectors("hello", [
            "semantic",
            "episodic",
        ]);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0][0]).toBe(
            "https://openrouter.ai/api/v1/embeddings",
        );
        const request = fetchMock.mock.calls[0][1];
        expect(JSON.parse(request.body)).toMatchObject({
            input: ["hello", "hello"],
            model: "openai/text-embedding-3-small",
        });
        expect(result).toEqual({
            semantic: [1, 0],
            episodic: [0, 1],
        });
    });
});
