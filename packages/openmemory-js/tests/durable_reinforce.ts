import { reinforceDurableMemory } from "../src/durable/repository";

const calls: Array<{ sql: string; params: unknown[] }> = [];
const db = {
  query: async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    if (sql.toLowerCase().includes("update")) {
      return {
        rows: [
          {
            id: "88888888-8888-4888-8888-888888888888",
            user_id: "durable_user",
            project_id: "durable_project",
            salience: 1,
          },
        ],
      };
    }
    return { rows: [] };
  },
};

async function main() {
  const reinforced = await reinforceDurableMemory(db, {
    id: "88888888-8888-4888-8888-888888888888",
    user_id: "durable_user",
    boost: 4,
    now: new Date("2026-05-14T00:00:00.000Z"),
  });

  if (!reinforced || reinforced.salience !== 1) {
    throw new Error("durable reinforce must return clamped salience");
  }
  const updateCall = calls.find((call) => call.sql.toLowerCase().includes("update"));
  if (!updateCall || updateCall.params[1] !== 1) {
    throw new Error("durable reinforce must clamp salience to 1");
  }

  const sqlText = calls.map((call) => call.sql).join("\n").toLowerCase();
  const order = calls.map((call) =>
    call.sql.trim().split(/\s+/)[0].toUpperCase(),
  );
  if (order[0] !== "BEGIN" || order[order.length - 1] !== "COMMIT") {
    throw new Error("durable reinforce must run in a transaction");
  }
  if (!sqlText.includes('"public"."memories"')) {
    throw new Error("durable reinforce must update memories");
  }
  if (!sqlText.includes('"public"."audit_log"')) {
    throw new Error("durable reinforce must write audit");
  }
  if (!JSON.stringify(calls).includes("memory.reinforce")) {
    throw new Error("audit row must describe memory.reinforce");
  }

  console.log("[DURABLE] reinforce contract verified");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
