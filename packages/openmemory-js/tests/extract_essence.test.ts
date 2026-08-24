import { describe, expect, it } from "vitest";
import { extract_essence } from "../src/memory/hsg";

describe("extract_essence", () => {
    it("falls back to a prefix when a single sentence exceeds the limit", () => {
        const raw =
            "This sentence has no terminator and is intentionally longer than the configured summary length";

        expect(extract_essence(raw, "semantic", 40)).toBe(raw.slice(0, 40));
    });

    it("does not return an empty summary for Chinese text without spaces", () => {
        const raw =
            "这是一条没有空格的长中文记忆，它包含多个短句。但是分句后仍可能被当成一个整体，因此摘要不能变成空字符串。";

        expect(extract_essence(raw, "semantic", 30)).toBe(raw.slice(0, 30));
    });
});
