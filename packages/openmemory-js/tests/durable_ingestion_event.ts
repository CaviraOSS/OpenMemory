import { createWorkingMemoryEvent } from "../src/durable/repository";
import { buildDurableSchemaSql, DURABLE_TABLES } from "../src/durable/schema";

const calls: Array<{ sql: string; params: unknown[] }> = [];
const db = {
  query: async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    if (sql.toLowerCase().includes("insert into") && sql.includes('"working_memory_events"')) {
      return {
        rows: [
          {
            id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
            status: "pending",
          },
        ],
      };
    }
    return { rows: [] };
  },
};

async function main() {
  const schemaSql = buildDurableSchemaSql({ schema: "public" }).join("\n");
  for (const table of ["working_memory_events", "extraction_candidates"]) {
    if (!DURABLE_TABLES.includes(table as any)) {
      throw new Error(`missing durable ingestion table export: ${table}`);
    }
    if (!schemaSql.includes(`"public"."${table}"`)) {
      throw new Error(`missing durable ingestion table SQL: ${table}`);
    }
  }

  const result = await createWorkingMemoryEvent(db, {
    id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
    user_id: "ingest_user",
    project_id: "ingest_project",
    source: {
      kind: "text",
      id: "fixture-1",
      content_type: "text/plain",
    },
    content: "Remember durable ingestion fixtures",
    metadata: { fixture: "text" },
    contracts: { recall_allowed: true },
    observed_at: "2026-05-15T00:00:00.000Z",
    now: new Date("2026-05-15T00:00:01.000Z"),
  });

  if (result.id !== "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa") {
    throw new Error("working memory event returned wrong id");
  }
  if (result.status !== "pending") {
    throw new Error("working memory event must start pending");
  }

  const sqlText = calls.map((call) => call.sql).join("\n").toLowerCase();
  const order = calls.map((call) =>
    call.sql.trim().split(/\s+/)[0].toUpperCase(),
  );
  if (order[0] !== "BEGIN" || order[order.length - 1] !== "COMMIT") {
    throw new Error("working memory event must be transactional");
  }
  if (!sqlText.includes('"public"."working_memory_events"')) {
    throw new Error("working memory event must insert raw event");
  }
  if (!sqlText.includes('"public"."audit_log"')) {
    throw new Error("working memory event must write audit");
  }
  if (!JSON.stringify(calls).includes("ingestion.event")) {
    throw new Error("audit row must describe ingestion.event");
  }

  console.log("[DURABLE] ingestion event contract verified");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

