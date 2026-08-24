import { afterEach, describe, expect, it, vi } from "vitest";

async function loadConfig(
    openaiKey: string,
    scopedOpenaiKey: string,
    dashscopeKey: string,
) {
    vi.resetModules();
    vi.stubEnv("OPENAI_API_KEY", openaiKey);
    vi.stubEnv("OM_OPENAI_API_KEY", scopedOpenaiKey);
    vi.stubEnv("DASHSCOPE_API_KEY", dashscopeKey);
    vi.stubEnv(
        "OM_OPENAI_BASE_URL",
        "https://workspace.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
    );
    vi.stubEnv("OM_OPENAI_MODEL", "text-embedding-v4");
    return await import("../src/core/cfg");
}

describe("DashScope OpenAI-compatible configuration", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    it("uses DASHSCOPE_API_KEY when OpenAI keys are absent", async () => {
        const { env } = await loadConfig("", "", "sk-dashscope-test");

        expect(env.openai_key).toBe("sk-dashscope-test");
        expect(env.openai_base_url).toBe(
            "https://workspace.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
        );
        expect(env.openai_model).toBe("text-embedding-v4");
    });

    it("preserves the existing OpenAI key precedence", async () => {
        const { env } = await loadConfig(
            "sk-openai-test",
            "sk-scoped-test",
            "sk-dashscope-test",
        );

        expect(env.openai_key).toBe("sk-openai-test");
    });
});
