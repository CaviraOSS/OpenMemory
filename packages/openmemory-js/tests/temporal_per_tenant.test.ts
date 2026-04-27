process.env.OM_EMBEDDINGS = "synthetic";
process.env.OM_METADATA_BACKEND = "sqlite";
process.env.OM_VECTOR_BACKEND = "sqlite";

import { describe, it, expect, beforeAll } from "vitest";
import { run_async } from "../src/core/db";
import { insert_fact, get_fact_by_id_for_user } from "../src/temporal_graph/store";
import {
    query_facts_in_range,
    get_facts_by_subject,
    search_facts,
    find_conflicting_facts,
    get_related_facts,
} from "../src/temporal_graph/query";

const T_ALICE = "tenant-alice";
const T_BOB = "tenant-bob";

describe("temporal_graph per-tenant isolation", () => {
    beforeAll(async () => {
        await run_async("DELETE FROM temporal_facts");
        await insert_fact({ subject: "S", predicate: "P", object: "O-A", user_id: T_ALICE, valid_from: new Date(), confidence: 1 });
        await insert_fact({ subject: "S", predicate: "P", object: "O-B", user_id: T_BOB, valid_from: new Date(), confidence: 1 });
    });

    it("get_facts_by_subject only returns the caller's tenant rows", async () => {
        const a = await get_facts_by_subject("S", { user_id: T_ALICE });
        const b = await get_facts_by_subject("S", { user_id: T_BOB });
        expect(a.map((f: any) => f.object)).toEqual(["O-A"]);
        expect(b.map((f: any) => f.object)).toEqual(["O-B"]);
    });

    it("search_facts is tenant-scoped", async () => {
        const a = await search_facts("O-", { user_id: T_ALICE });
        expect(a.every((f: any) => f.user_id === T_ALICE)).toBe(true);
    });

    it("query_facts_in_range is tenant-scoped", async () => {
        const a = await query_facts_in_range({ user_id: T_ALICE, from: new Date(0), to: new Date() });
        expect(a.every((f: any) => f.user_id === T_ALICE)).toBe(true);
    });

    it("find_conflicting_facts is tenant-scoped", async () => {
        const a = await find_conflicting_facts({ subject: "S", predicate: "P", user_id: T_ALICE });
        expect(a.every((f: any) => f.user_id === T_ALICE)).toBe(true);
    });

    it("get_related_facts is tenant-scoped", async () => {
        const aliceFacts = await get_facts_by_subject("S", { user_id: T_ALICE });
        const a = await get_related_facts((aliceFacts[0] as any).id, { user_id: T_ALICE });
        expect(a.every((r: any) => r.fact.user_id === T_ALICE)).toBe(true);
    });

    it("get_fact_by_id_for_user enforces tenant", async () => {
        const all = await get_facts_by_subject("S", { user_id: T_ALICE });
        expect(all.length).toBe(1);
        const id = (all[0] as any).id;
        const aliceCanSee = await get_fact_by_id_for_user(id, T_ALICE);
        const bobCannot = await get_fact_by_id_for_user(id, T_BOB);
        expect(aliceCanSee).not.toBeNull();
        expect(bobCannot).toBeNull();
    });

    it("migrate quarantines NULL user_id rows once and is idempotent", async () => {
        const { LEGACY_ORPHAN_TENANT } = await import("../src/core/identifiers");
        await run_async(
            `INSERT INTO temporal_facts (id, user_id, subject, predicate, object, valid_from, confidence, last_updated) VALUES (?, NULL, ?, ?, ?, ?, ?, ?)`,
            ["legacy-1", "S", "P", "O-legacy", Date.now(), 1, Date.now()],
        );
        await run_async(`UPDATE temporal_facts SET user_id = ? WHERE user_id IS NULL`, [LEGACY_ORPHAN_TENANT]);
        const after_first: any[] = await (await import("../src/core/db")).all_async(
            `SELECT user_id FROM temporal_facts WHERE id = ?`,
            ["legacy-1"],
        );
        expect(after_first[0].user_id).toBe(LEGACY_ORPHAN_TENANT);
        await run_async(`UPDATE temporal_facts SET user_id = ? WHERE user_id IS NULL`, [LEGACY_ORPHAN_TENANT]);
        const after_second: any[] = await (await import("../src/core/db")).all_async(
            `SELECT user_id FROM temporal_facts WHERE id = ?`,
            ["legacy-1"],
        );
        expect(after_second[0].user_id).toBe(LEGACY_ORPHAN_TENANT);
        const aliceSees = await get_facts_by_subject("S", { user_id: T_ALICE });
        expect(aliceSees.find((f: any) => f.id === "legacy-1")).toBeUndefined();
    });
});
