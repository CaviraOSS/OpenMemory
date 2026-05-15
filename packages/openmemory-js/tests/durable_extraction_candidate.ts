import { createExtractionCandidate } from "../src/durable/repository";

const calls: Array<{ sql: string; params: unknown[] }> = [];
const db = {
  query: async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    if (sql.toLowerCase().includes("insert into") && sql.includes('"extraction_candidates"')) {
      return {
        rows: [
          {
            id: "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb",
            status: "pending",
          },
        ],
      };
    }
    return { rows: [] };
  },
};

async function main() {
  const result = await createExtractionCandidate(db, {
    id: "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb",
    event_id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
    user_id: "ingest_user",
    project_id: "ingest_project",
    content: "Durable extracted candidate",
    facets: { semantic: true },
    entities: [{ type: "concept", name: "Durable ingestion" }],
    edges: [{ type: "mentions", target_memory_id: "cccccccc-3333-4333-8333-cccccccccccc" }],
    contracts: { recall_allowed: true },
    confidence: 0.75,
    metadata: { fixture: "candidate" },
    now: new Date("2026-05-15T00:00:02.000Z"),
  });

  if (result.id !== "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb") {
    throw new Error("extraction candidate returned wrong id");
  }
  if (result.status !== "pending") {
    throw new Error("extraction candidate must start pending");
  }

  const sqlText = calls.map((call) => call.sql).join("\n").toLowerCase();
  const order = calls.map((call) =>
    call.sql.trim().split(/\s+/)[0].toUpperCase(),
  );
  if (order[0] !== "BEGIN" || order[order.length - 1] !== "COMMIT") {
    throw new Error("extraction candidate must be transactional");
  }
  if (!sqlText.includes('"public"."extraction_candidates"')) {
    throw new Error("extraction candidate must insert candidate row");
  }
  if (!sqlText.includes('"public"."audit_log"')) {
    throw new Error("extraction candidate must write audit");
  }
  if (!JSON.stringify(calls).includes("ingestion.candidate")) {
    throw new Error("audit row must describe ingestion.candidate");
  }

  console.log("[DURABLE] extraction candidate contract verified");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

