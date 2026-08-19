import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { get_model } from "../src/core/models";

describe("orcarouter provider wiring", () => {
    let env: any;
    let getEmbeddingInfo: any;
    let getEmbeddingProvider: any;

    beforeAll(async () => {
        // Set env BEFORE evaluating cfg.ts. vi.resetModules() forces a fresh
        // module registry so the singleton cfg object reads the orcarouter
        // settings instead of the CI default (synthetic).
        vi.resetModules();
        process.env.OM_EMBEDDINGS = "orcarouter";
        process.env.ORCAROUTER_API_KEY = "sk-orca-test";
        process.env.OM_ORCAROUTER_BASE_URL = "https://api.orcarouter.ai/v1";
        process.env.OM_ORCAROUTER_EMBEDDING_MODEL = "orcarouter/auto";
        process.env.OM_EMBED_MODE = "simple";
        const cfg = await import("../src/core/cfg");
        const embed = await import("../src/memory/embed");
        env = cfg.env;
        getEmbeddingInfo = embed.getEmbeddingInfo;
        getEmbeddingProvider = embed.getEmbeddingProvider;
    });

    afterAll(() => {
        // Restore the environment so later test files (single-fork) see the
        // CI defaults, not the orcarouter settings from this file.
        delete process.env.OM_EMBEDDINGS;
        delete process.env.ORCAROUTER_API_KEY;
        delete process.env.OM_ORCAROUTER_BASE_URL;
        delete process.env.OM_ORCAROUTER_EMBEDDING_MODEL;
        delete process.env.OM_EMBED_MODE;
    });

    it("env exposes orcarouter config", () => {
        expect(env.orcarouter_key).toBe("sk-orca-test");
        expect(env.orcarouter_base_url).toBe("https://api.orcarouter.ai/v1");
        expect(env.emb_kind).toBe("orcarouter");
    });

    it("get_model resolves the orcarouter default for every sector", () => {
        for (const sector of [
            "episodic",
            "semantic",
            "procedural",
            "emotional",
            "reflective",
        ]) {
            expect(get_model(sector, "orcarouter")).toBe("orcarouter/auto");
        }
    });

    it("get_model honors the per-sector override env var", () => {
        const prev = process.env.OM_ORCAROUTER_EMBEDDING_MODEL;
        process.env.OM_ORCAROUTER_EMBEDDING_MODEL = "orcarouter/custom";
        try {
            expect(get_model("semantic", "orcarouter")).toBe(
                "orcarouter/custom",
            );
        } finally {
            process.env.OM_ORCAROUTER_EMBEDDING_MODEL = prev;
        }
    });

    it("reports orcarouter as the active embedding provider", () => {
        expect(getEmbeddingProvider()).toBe("orcarouter");
    });

    it("getEmbeddingInfo describes the orcarouter provider", () => {
        const info = getEmbeddingInfo();
        expect(info.provider).toBe("orcarouter");
        expect(info.configured).toBe(true);
        expect(info.base_url).toBe("https://api.orcarouter.ai/v1");
        expect(info.models.semantic).toBe("orcarouter/auto");
        // OrcaRouter supports batch embeddings, so simple mode is batch-capable
        expect(info.batch_support).toBe(true);
    });
});
