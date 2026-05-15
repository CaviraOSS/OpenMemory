import { explainDurableMemory } from "../src/durable/repository";

const calls: Array<{ sql: string; params: unknown[] }> = [];
const db = {
  query: async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    return {
      rows: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          content: "durable explain test memory",
          facets: { semantic: true },
          contracts: { strict_recall_requires_source: true, recall_allowed: true },
          metadata: { test: true },
          salience: 0.7,
          confidence: 0.85,
          valid_from: "2026-05-13T00:00:00.000Z",
          valid_to: null,
          observed_at: "2026-05-14T00:00:00.000Z",
          recorded_at: "2026-05-14T00:00:01.000Z",
          superseded_at: null,
          provenance: [{ source_kind: "test", source_id: "durable-explain" }],
          contradictions: [{ id: "c1", status: "open" }],
          inference_path: [{ id: "i1", inference_type: "derived" }],
          audit_events: [{ event_type: "memory.remember" }],
          versions: [{ version: 1, content: "durable explain test memory" }],
        },
      ],
    };
  },
};

async function main() {
  const explained = await explainDurableMemory(db, {
    id: "33333333-3333-4333-8333-333333333333",
  });

  if (!explained) {
    throw new Error("durable explain must return a memory");
  }
  if (explained.id !== "33333333-3333-4333-8333-333333333333") {
    throw new Error("durable explain mapped the wrong id");
  }
  if (explained.provenance.length !== 1) {
    throw new Error("durable explain must include provenance");
  }
  if (explained.contradictions.length !== 1) {
    throw new Error("durable explain must include contradictions");
  }
  if (explained.inference_path.length !== 1) {
    throw new Error("durable explain must include inference path");
  }
  if (explained.audit_events.length !== 1) {
    throw new Error("durable explain must include audit events");
  }
  if (explained.versions.length !== 1) {
    throw new Error("durable explain must include memory versions");
  }
  if (explained.bitemporal.recorded_at !== "2026-05-14T00:00:01.000Z") {
    throw new Error("durable explain must expose bitemporal timestamps");
  }
  if (explained.score_components.confidence !== 0.85) {
    throw new Error("durable explain must expose confidence score component");
  }
  if (explained.score_components.provenance !== 1) {
    throw new Error("durable explain must expose provenance score component");
  }
  if (explained.score_components.contradiction_penalty !== 1) {
    throw new Error("durable explain must expose contradiction penalty");
  }
  if (!explained.score_components.contracts.recall_allowed) {
    throw new Error("durable explain must expose contract state");
  }
  if (
    !Array.isArray((explained as any).reasons) ||
    !(explained as any).reasons.includes("confidence 0.85") ||
    !(explained as any).reasons.includes("1 provenance source") ||
    !(explained as any).reasons.includes("1 open contradiction") ||
    !(explained as any).reasons.includes("recall allowed by contract")
  ) {
    throw new Error(`durable explain must expose factual reasons: ${JSON.stringify(explained)}`);
  }

  const sqlText = calls.map((call) => call.sql).join("\n").toLowerCase();
  for (const table of [
    '"public"."memories"',
    '"public"."provenance"',
    '"public"."contradictions"',
    '"public"."inferences"',
    '"public"."memory_versions"',
    '"public"."audit_log"',
  ]) {
    if (!sqlText.includes(table)) {
      throw new Error(`durable explain must query ${table}`);
    }
  }
  for (const column of [
    "valid_from",
    "valid_to",
    "observed_at",
    "recorded_at",
    "superseded_at",
  ]) {
    if (!sqlText.includes(column)) {
      throw new Error(`durable explain must include ${column}`);
    }
  }
  if (sqlText.includes("output_memory_id") || sqlText.includes("inference_type")) {
    throw new Error("durable explain must use the durable inferences schema");
  }
  for (const column of ["memory_id", "derived_from", "inference_method"]) {
    if (!sqlText.includes(column)) {
      throw new Error(`durable explain must include inference ${column}`);
    }
  }

  console.log("[DURABLE] explain contract verified");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
