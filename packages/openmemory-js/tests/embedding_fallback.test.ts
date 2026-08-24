import { afterEach, describe, expect, it, vi } from "vitest";

async function loadEmbed(fallback: string) {
    vi.resetModules();
    vi.stubEnv("OM_TIER", "deep");
    vi.stubEnv("OM_EMBEDDINGS", "openai");
    vi.stubEnv("OM_EMBEDDING_FALLBACK", fallback);
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("OM_OPENAI_API_KEY", "");
    return await import("../src/memory/embed");
}

describe("embedding fallback chain", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    it("throws after the configured providers fail", async () => {
        const { embedForSector } = await loadEmbed("");

        await expect(
            embedForSector("remember this", "semantic"),
        ).rejects.toThrow("OpenAI key missing");
    });

    it("still uses synthetic vectors when explicitly configured", async () => {
        const { embedForSector } = await loadEmbed("synthetic");

        await expect(
            embedForSector("remember this", "semantic"),
        ).resolves.toHaveLength(1536);
    });
});
