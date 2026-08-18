import { describe, expect, it } from "vitest";
import { latency, match_hits, percentile, score_at_k } from "../src/metrics";
import { as_hits } from "../src/providers/shared";
import { smoke_cases } from "../src/datasets";
import { benchmark_source_ref } from "../src/source_ref";

const item = smoke_cases[0];

describe("retrieval metrics", () => {
    it("normalizes primitive string results", () => {
        expect(as_hits(["plain chunk"])).toEqual([{ text: "plain chunk", metadata: { raw: "plain chunk" } }]);
    });

    it("uses lexical attribution by default and requires explicit source-id trust", () => {
        const direct = match_hits([{ text: "rewritten", metadata: { nested: { source_event_id: "extract:evidence" } } }], item);
        const diagnostic = match_hits([{ text: "rewritten", metadata: { nested: { source_event_id: "extract:evidence" } } }], item, 0.45, true);
        const lexical = match_hits([{ text: "My dentist is Dr. Lin", metadata: {} }], item);
        expect(direct[0]).toMatchObject({ evidence_id: null, match_method: "none" });
        expect(diagnostic[0]).toMatchObject({ evidence_id: "extract:evidence", match_method: "source_id" });
        expect(lexical[0]).toMatchObject({ evidence_id: "extract:evidence", match_method: "lexical" });
    });

    it("does not count duplicate evidence twice", () => {
        const hits = match_hits([
            { text: "one", metadata: { source_event_id: "extract:evidence" } },
            { text: "duplicate", metadata: { source_event_id: "extract:evidence" } },
        ], item, 0.45, true);
        expect(score_at_k(hits, item.evidence_ids, 2)).toMatchObject({ hit_rate: 1, recall: 1, precision: 0.5, mrr: 1 });
    });

    it("attributes opaque source references without exposing evidence ids", () => {
        const evidence = item.events.find((event) => event.id === "extract:evidence")!;
        const ref = benchmark_source_ref(evidence);
        expect(ref).not.toContain(evidence.id);
        const hits = match_hits([{ text: "derived memory", metadata: { source_ref: ref } }], item);
        expect(hits[0]).toMatchObject({ evidence_id: evidence.id, match_method: "source_ref" });
    });

    it("selects the matching turn from opaque session references", () => {
        const refs = item.events.map(benchmark_source_ref);
        const hits = match_hits([{ text: "My dentist is Dr. Lin", metadata: { source_refs: refs } }], item);
        expect(hits[0]).toMatchObject({ evidence_id: "extract:evidence", match_method: "source_ref" });
    });

    it("computes interpolated percentiles and standard deviation", () => {
        expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
        expect(latency([1, 2, 3])).toMatchObject({ count: 3, min: 1, max: 3, mean: 2, p50: 2 });
        expect(latency([1, 2, 3]).stddev).toBeGreaterThan(0);
    });
});
