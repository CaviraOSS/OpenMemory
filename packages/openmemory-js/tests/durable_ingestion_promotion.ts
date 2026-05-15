import { promoteExtractionCandidate } from "../src/durable/repository";

const calls: Array<{ sql: string; params: unknown[] }> = [];
const db = {
  query: async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    if (/^\s*select\b/i.test(sql) && sql.includes('"extraction_candidates"')) {
      return {
        rows: [
          {
            id: "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb",
            event_id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
            user_id: "ingest_user",
            project_id: "ingest_project",
            content: "Promoted durable memory",
            facets: { semantic: true },
            entities: [{ type: "concept", name: "Promotion", role: "subject" }],
            edges: [{ type: "mentions" }],
            contracts: { recall_allowed: true },
            confidence: 0.8,
            metadata: { fixture: "promotion" },
          },
        ],
      };
    }
    return { rows: [] };
  },
};

async function main() {
  const result = await promoteExtractionCandidate(db, {
    candidate_id: "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb",
    memory_id: "cccccccc-3333-4333-8333-cccccccccccc",
    source: { kind: "document", id: "fixture-doc" },
    now: new Date("2026-05-15T00:00:03.000Z"),
  });

  if (result?.id !== "cccccccc-3333-4333-8333-cccccccccccc") {
    throw new Error("promotion returned wrong memory id");
  }
  if (result.status !== "stored") {
    throw new Error("promotion must return stored memory status");
  }

  const sqlText = calls.map((call) => call.sql).join("\n").toLowerCase();
  const order = calls.map((call) =>
    call.sql.trim().split(/\s+/)[0].toUpperCase(),
  );
  if (order[0] !== "BEGIN" || order[order.length - 1] !== "COMMIT") {
    throw new Error("candidate promotion must be transactional");
  }
  for (const table of [
    '"public"."extraction_candidates"',
    '"public"."memories"',
    '"public"."memory_versions"',
    '"public"."provenance"',
    '"public"."audit_log"',
  ]) {
    if (!sqlText.includes(table)) {
      throw new Error(`promotion missing table ${table}`);
    }
  }
  if (!JSON.stringify(calls).includes("ingestion.promote")) {
    throw new Error("promotion audit must describe ingestion.promote");
  }
  if (!JSON.stringify(calls).includes("accepted")) {
    throw new Error("promotion must mark candidate accepted");
  }

  console.log("[DURABLE] ingestion promotion contract verified");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

