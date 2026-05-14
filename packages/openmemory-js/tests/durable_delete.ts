import { deleteDurableMemory } from "../src/durable/repository";

const calls: Array<{ sql: string; params: unknown[] }> = [];
const db = {
  query: async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    if (sql.toLowerCase().includes("update")) {
      return {
        rows: [
          {
            id: "55555555-5555-4555-8555-555555555555",
            user_id: "durable_user",
            project_id: "durable_project",
            content: "deleted memory",
          },
        ],
      };
    }
    return { rows: [] };
  },
};

async function main() {
  const deleted = await deleteDurableMemory(db, {
    id: "55555555-5555-4555-8555-555555555555",
    user_id: "durable_user",
    now: new Date("2026-05-14T00:00:00.000Z"),
  });

  if (!deleted) {
    throw new Error("durable delete must report deleted memory");
  }

  const sqlText = calls.map((call) => call.sql).join("\n").toLowerCase();
  const order = calls.map((call) =>
    call.sql.trim().split(/\s+/)[0].toUpperCase(),
  );

  if (order[0] !== "BEGIN") {
    throw new Error("durable delete must begin a transaction");
  }
  if (order[order.length - 1] !== "COMMIT") {
    throw new Error("durable delete must commit after audit");
  }
  if (!sqlText.includes('"public"."memories"')) {
    throw new Error("durable delete must update memories");
  }
  if (!sqlText.includes("superseded_at")) {
    throw new Error("durable delete must soft-delete via superseded_at");
  }
  if (!sqlText.includes('"public"."audit_log"')) {
    throw new Error("durable delete must insert audit row");
  }
  if (!JSON.stringify(calls).includes("memory.delete")) {
    throw new Error("audit row must describe memory.delete");
  }

  console.log("[DURABLE] delete contract verified");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
