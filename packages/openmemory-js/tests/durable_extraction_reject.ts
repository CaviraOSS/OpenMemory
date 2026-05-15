import { rejectExtractionCandidate } from "../src/durable/repository";

const calls: Array<{ sql: string; params: unknown[] }> = [];
const db = {
  query: async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    if (sql.toLowerCase().includes("update") && sql.includes('"extraction_candidates"')) {
      return {
        rows: [
          {
            id: "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb",
            event_id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
            user_id: "ingest_user",
            project_id: "ingest_project",
            status: "rejected",
            rejection_reason: "low confidence",
          },
        ],
      };
    }
    return { rows: [] };
  },
};

async function main() {
  const result = await rejectExtractionCandidate(db, {
    candidate_id: "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb",
    reason: "low confidence",
    user_id: "ingest_user",
    now: new Date("2026-05-15T00:00:04.000Z"),
  });

  if (result?.id !== "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb") {
    throw new Error("candidate rejection returned wrong id");
  }
  if (result.status !== "rejected" || result.reason !== "low confidence") {
    throw new Error("candidate rejection returned wrong status or reason");
  }

  const sqlText = calls.map((call) => call.sql).join("\n").toLowerCase();
  const order = calls.map((call) =>
    call.sql.trim().split(/\s+/)[0].toUpperCase(),
  );
  if (order[0] !== "BEGIN" || order[order.length - 1] !== "COMMIT") {
    throw new Error("candidate rejection must be transactional");
  }
  if (!sqlText.includes('"public"."extraction_candidates"')) {
    throw new Error("candidate rejection must update extraction_candidates");
  }
  if (!sqlText.includes('"public"."audit_log"')) {
    throw new Error("candidate rejection must write audit");
  }
  if (!JSON.stringify(calls).includes("ingestion.reject")) {
    throw new Error("candidate rejection audit must describe ingestion.reject");
  }

  console.log("[DURABLE] extraction rejection contract verified");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

