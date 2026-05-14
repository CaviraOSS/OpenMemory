import { createDurableConsolidation } from "../src/durable/repository";

const calls: Array<{ sql: string; params: unknown[] }> = [];
const db = {
  query: async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    if (sql.toLowerCase().includes("insert into") && sql.includes('"consolidations"')) {
      return {
        rows: [
          {
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            status: "pending",
          },
        ],
      };
    }
    return { rows: [] };
  },
};

async function main() {
  const result = await createDurableConsolidation(db, {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    user_id: "durable_user",
    project_id: "durable_project",
    scope: { type: "project", project_id: "durable_project" },
    source_memory_ids: ["11111111-1111-4111-8111-111111111111"],
    metadata: { reason: "manual" },
    now: new Date("2026-05-14T00:00:00.000Z"),
  });

  if (result.id !== "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa") {
    throw new Error("durable consolidation returned wrong id");
  }
  if (result.status !== "pending") {
    throw new Error("durable consolidation must start pending");
  }

  const sqlText = calls.map((call) => call.sql).join("\n").toLowerCase();
  const order = calls.map((call) =>
    call.sql.trim().split(/\s+/)[0].toUpperCase(),
  );
  if (order[0] !== "BEGIN" || order[order.length - 1] !== "COMMIT") {
    throw new Error("durable consolidation must run in a transaction");
  }
  if (!sqlText.includes('"public"."consolidations"')) {
    throw new Error("durable consolidation must insert consolidation row");
  }
  if (!sqlText.includes('"public"."audit_log"')) {
    throw new Error("durable consolidation must write audit");
  }
  if (!JSON.stringify(calls).includes("consolidation.request")) {
    throw new Error("audit row must describe consolidation.request");
  }

  console.log("[DURABLE] consolidation contract verified");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
