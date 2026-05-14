import { rememberDurableMemory } from "../src/durable/repository";

const calls: Array<{ sql: string; params: unknown[] }> = [];
const db = {
  query: async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
  },
};

async function main() {
  const result = await rememberDurableMemory(db, {
    id: "11111111-1111-4111-8111-111111111111",
    content: "durable repository test memory",
    user_id: "durable_user",
    project_id: "durable_project",
    facets: { semantic: true },
    contracts: { strict_recall_requires_source: true },
    metadata: { test: true },
    source: { kind: "test", id: "durable-repository" },
    now: new Date("2026-05-14T00:00:00.000Z"),
  });

  if (result.id !== "11111111-1111-4111-8111-111111111111") {
    throw new Error("durable repository returned wrong id");
  }

  const sqlText = calls.map((call) => call.sql).join("\n");
  const order = calls.map((call) =>
    call.sql.trim().split(/\s+/)[0].toUpperCase(),
  );

  if (order[0] !== "BEGIN") {
    throw new Error("durable write must begin a transaction");
  }
  if (order[order.length - 1] !== "COMMIT") {
    throw new Error("durable write must commit after all inserts");
  }
  if (!sqlText.includes('"public"."memories"')) {
    throw new Error("durable write must insert memory row");
  }
  if (!sqlText.includes('"public"."provenance"')) {
    throw new Error("durable write must insert provenance row");
  }
  if (!sqlText.includes('"public"."audit_log"')) {
    throw new Error("durable write must insert audit row");
  }

  const auditCall = calls.find((call) => call.sql.includes('"audit_log"'));
  if (
    !auditCall ||
    !JSON.stringify(auditCall.params).includes("memory.remember")
  ) {
    throw new Error("audit row must describe memory.remember");
  }

  console.log("[DURABLE] repository write contract verified");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
