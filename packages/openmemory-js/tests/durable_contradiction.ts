import { resolveDurableContradiction } from "../src/durable/repository";

const calls: Array<{ sql: string; params: unknown[] }> = [];
const db = {
  query: async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    if (sql.toLowerCase().includes("update")) {
      return {
        rows: [
          {
            id: "99999999-9999-4999-8999-999999999999",
            user_id: "durable_user",
            project_id: "durable_project",
            status: "resolved",
            resolution: "keep_newer",
          },
        ],
      };
    }
    return { rows: [] };
  },
};

async function main() {
  const resolved = await resolveDurableContradiction(db, {
    id: "99999999-9999-4999-8999-999999999999",
    resolution: "keep_newer",
    user_id: "durable_user",
    now: new Date("2026-05-14T00:00:00.000Z"),
  });

  if (!resolved || resolved.status !== "resolved") {
    throw new Error("durable contradiction resolve must return resolved row");
  }

  const sqlText = calls.map((call) => call.sql).join("\n").toLowerCase();
  const order = calls.map((call) =>
    call.sql.trim().split(/\s+/)[0].toUpperCase(),
  );
  if (order[0] !== "BEGIN" || order[order.length - 1] !== "COMMIT") {
    throw new Error("durable contradiction resolve must run in a transaction");
  }
  if (!sqlText.includes('"public"."contradictions"')) {
    throw new Error("durable contradiction resolve must update contradictions");
  }
  if (!sqlText.includes("resolved_at")) {
    throw new Error("durable contradiction resolve must set resolved_at");
  }
  if (!sqlText.includes('"public"."audit_log"')) {
    throw new Error("durable contradiction resolve must write audit");
  }
  if (!JSON.stringify(calls).includes("contradiction.resolve")) {
    throw new Error("audit row must describe contradiction.resolve");
  }

  console.log("[DURABLE] contradiction resolve contract verified");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
