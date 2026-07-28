import { describe, expect, it } from "vitest";
import { classify_content } from "../src/memory/hsg";

describe("Chinese memory sector classifier", () => {
    const samples = [
        ["昨天我参加了项目复盘会。", "episodic"],
        ["北京是中国的首都。", "semantic"],
        ["部署流程：第一步安装依赖，然后运行测试。", "procedural"],
        ["我最近很焦虑，也有点烦躁。", "emotional"],
        ["复盘后我意识到，沟通前应该先明确目标。", "reflective"],
    ] as const;

    it.each(samples)("classifies '%s' as %s", (text, primary) => {
        expect(classify_content(text).primary).toBe(primary);
    });

    it("keeps secondary sectors for mixed Chinese memories", () => {
        const result = classify_content(
            "今天我被老板表扬了，感觉特别开心。",
        );

        expect(result.primary).toBe("emotional");
        expect(result.additional).toContain("episodic");
    });

    it("still honors an explicit sector override", () => {
        expect(
            classify_content("这段文字不依赖关键词。", {
                sector: "procedural",
            }),
        ).toEqual({
            primary: "procedural",
            additional: [],
            confidence: 1,
        });
    });
});
