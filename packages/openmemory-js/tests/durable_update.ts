import { updateDurableMemory } from "../src/durable/repository";

const calls: Array<{ sql: string; params: unknown[] }> = [];
const db = {
  query: async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    const lowered = sql.toLowerCase();
    if (lowered.includes("select") && lowered.includes("max(version)")) {
      return { rows: [{ version: 2 }] };
    }
    if (lowered.includes("update")) {
      return {
        rows: [
          {
            id: "77777777-7777-4777-8777-777777777777",
            user_id: "durable_user",
            project_id: "durable_project",
            content: "updated durable memory",
            facets: { semantic: true },
            contracts: { sourced: true },
            metadata: { updated: true },
            recorded_at: "2026-05-14T00:00:00.000Z",
          },
        ],
      };
    }
    return { rows: [] };
  },
};

async function main() {
  const updated = await updateDurableMemory(db, {
    id: "77777777-7777-4777-8777-777777777777",
    user_id: "durable_user",
    content: "updated durable memory",
    facets: { semantic: true },
    contracts: { sourced: true },
    metadata: { updated: true },
    now: new Date("2026-05-14T00:00:00.000Z"),
  });

  if (!updated || updated.version !== 3) {
    throw new Error("durable update must return next version");
  }

  const sqlText = calls.map((call) => call.sql).join("\n").toLowerCase();
  const order = calls.map((call) =>
    call.sql.trim().split(/\s+/)[0].toUpperCase(),
  );
  if (order[0] !== "BEGIN" || order[order.length - 1] !== "COMMIT") {
    throw new Error("durable update must run in a transaction");
  }
  if (!sqlText.includes('"public"."memories"')) {
    throw new Error("durable update must update memories");
  }
  if (!sqlText.includes('"public"."memory_versions"')) {
    throw new Error("durable update must append memory_versions");
  }
  if (!sqlText.includes('"public"."audit_log"')) {
    throw new Error("durable update must write audit");
  }
  if (!JSON.stringify(calls).includes("memory.update")) {
    throw new Error("audit row must describe memory.update");
  }

  console.log("[DURABLE] update contract verified");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
