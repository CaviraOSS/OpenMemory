import {
  getDurableMemory,
  listDurableMemories,
} from "../src/durable/repository";

const calls: Array<{ sql: string; params: unknown[] }> = [];
const db = {
  query: async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    return {
      rows: [
        {
          id: "66666666-6666-4666-8666-666666666666",
          user_id: "durable_user",
          project_id: "durable_project",
          content: "durable get list memory",
          facets: { semantic: true },
          contracts: { sourced: true },
          metadata: { test: true },
          salience: 0.5,
          confidence: 0.9,
          valid_from: "2026-05-13T00:00:00.000Z",
          valid_to: null,
          observed_at: "2026-05-14T00:00:00.000Z",
          recorded_at: "2026-05-14T00:00:01.000Z",
          superseded_at: null,
          provenance_count: "1",
          version_count: "2",
        },
      ],
    };
  },
};

async function main() {
  const memory = await getDurableMemory(db, {
    id: "66666666-6666-4666-8666-666666666666",
    user_id: "durable_user",
    project_id: "durable_project",
  });

  if (!memory) throw new Error("durable get must return memory");
  if (memory.version_count !== 2) {
    throw new Error("durable get must map version count");
  }
  if (memory.provenance_count !== 1) {
    throw new Error("durable get must map provenance count");
  }
  if (memory.bitemporal.recorded_at !== "2026-05-14T00:00:01.000Z") {
    throw new Error("durable get must map bitemporal fields");
  }

  const listed = await listDurableMemories(db, {
    user_id: "durable_user",
    project_id: "durable_project",
    limit: 25,
    offset: 5,
  });
  if (listed.items.length !== 1 || listed.items[0].id !== memory.id) {
    throw new Error("durable list must map rows");
  }

  const sqlText = calls.map((call) => call.sql).join("\n").toLowerCase();
  if (!sqlText.includes('"public"."memories"')) {
    throw new Error("durable get/list must query memories");
  }
  if (!sqlText.includes('"public"."provenance"')) {
    throw new Error("durable get/list must include provenance summary");
  }
  if (!sqlText.includes('"public"."memory_versions"')) {
    throw new Error("durable get/list must include version summary");
  }
  if (!sqlText.includes("superseded_at is null")) {
    throw new Error("durable get/list must exclude superseded memories");
  }
  if (!sqlText.includes("m.user_id =")) {
    throw new Error("durable get/list must apply user filter");
  }
  if (!sqlText.includes("m.project_id =") || !sqlText.includes("m.project_id is null")) {
    throw new Error("durable get/list must allow project and global records");
  }

  console.log("[DURABLE] get/list contract verified");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
