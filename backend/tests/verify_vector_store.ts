import { PostgresVectorStore } from "../src/core/vector/postgres";
import { VectorStore } from "../src/core/vector_store";

// Mock DbOps
const mockDb = {
    run_async: async (sql: string, params?: any[]) => {
        console.log(`[MockDB] run: ${sql} params: ${params}`);
    },
    get_async: async (sql: string, params?: any[]) => {
        console.log(`[MockDB] get: ${sql} params: ${params}`);
        return null;
    },
    all_async: async (sql: string, params?: any[]) => {
        console.log(`[MockDB] all: ${sql} params: ${params}`);
        return [];
    }
};

async function verify() {
    console.log("Verifying PostgresVectorStore...");
    const pgStore = new PostgresVectorStore(mockDb);
    await pgStore.storeVector("id1", "semantic", [0.1, 0.2], 2);
    await pgStore.searchSimilar("semantic", [0.1, 0.2], 5);
    await pgStore.deleteVector("id1", "semantic");

    console.log("\nVerification complete.");
}

verify().catch(console.error);
