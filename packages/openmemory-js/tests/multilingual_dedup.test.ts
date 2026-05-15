import { describe, expect, it } from "vitest";
import { canonical_tokens_from_text, tokenize } from "../src/utils/text";
import { compute_simhash } from "../src/memory/hsg";

describe("multilingual dedup", () => {
    const left = "我喜欢健身";
    const right = "我喜欢普洱茶";

    it("tokenizes Chinese text into character bigrams", () => {
        expect(tokenize(right)).toEqual([
            "我喜",
            "喜欢",
            "欢普",
            "普洱",
            "洱茶",
        ]);
    });

    it("produces non-empty canonical token sets for each phrase", () => {
        const leftTokens = canonical_tokens_from_text(left);
        const rightTokens = canonical_tokens_from_text(right);
        expect(leftTokens.length).toBeGreaterThan(0);
        expect(rightTokens.length).toBeGreaterThan(0);
    });

    it("produces distinct canonical tokens for different phrases", () => {
        const leftTokens = new Set(canonical_tokens_from_text(left));
        const rightTokens = new Set(canonical_tokens_from_text(right));
        expect(leftTokens).not.toEqual(rightTokens);
    });

    it("computes distinct simhashes for distinct phrases", () => {
        expect(compute_simhash(left)).not.toEqual(compute_simhash(right));
        expect(compute_simhash("!!!")).not.toEqual(compute_simhash("???"));
    });

    it("computes a stable simhash for identical input", () => {
        expect(compute_simhash("!!!")).toEqual(compute_simhash("!!!"));
    });
});
