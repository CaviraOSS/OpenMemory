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
    entities: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        type: "person",
        name: "Ada Lovelace",
        aliases: ["Ada"],
        role: "subject",
        confidence: 0.9,
      },
    ],
    edges: [
      {
        id: "33333333-3333-4333-8333-333333333333",
        target_memory_id: "44444444-4444-4444-8444-444444444444",
        type: "supports",
        weight: 0.8,
      },
    ],
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
  if (!sqlText.includes('"public"."memory_versions"')) {
    throw new Error("durable write must insert append-only memory version row");
  }
  if (!sqlText.includes('"public"."provenance"')) {
    throw new Error("durable write must insert provenance row");
  }
  if (!sqlText.includes('"public"."audit_log"')) {
    throw new Error("durable write must insert audit row");
  }
  if (!sqlText.includes('"public"."entities"')) {
    throw new Error("durable write must insert entity rows");
  }
  if (!sqlText.includes('"public"."memory_entities"')) {
    throw new Error("durable write must link memories to entities");
  }
  if (!sqlText.includes('"public"."edges"')) {
    throw new Error("durable write must insert edge rows");
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
