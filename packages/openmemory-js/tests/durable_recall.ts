import { recallDurableMemory } from "../src/durable/repository";

const queryCalls: { sql: string, params?: unknown[]}[] = [];

const db = {
    query: async (sql: string, params?: unknown[]) => { queryCalls.push({ sql, params }); return { rows: [] }; },
    all: async (sql: string, params?: unknown[]) => { queryCalls.push({ sql, params }); return []; }
};

async function main() {
    await recallDurableMemory(db, {
        query: "durable recall test",
        mode: "strict",
        user_id: "test",
        project_id: "test-proj",
        at_time: new Date()
    });

    const sqlText = queryCalls.map((c) => c.sql).join("\n");
    if (!sqlText.includes('memories')) {
        throw new Error("Recall must query memories");
    }
    if (!sqlText.includes('provenance')) {
        throw new Error("Recall must query provenance");
    }
    if (!sqlText.includes('contradictions')) {
        throw new Error("Recall must query contradictions");
    }
    if (!sqlText.includes('observed_at') && !sqlText.includes('recorded_at') && !sqlText.includes('valid_from')) {
        throw new Error("Recall must query bitemporal columns");
    }

    console.log("[DURABLE] recall query shape verified");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
