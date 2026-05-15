import { recallDurableMemories } from "../src/durable/repository";

const calls: Array<{ sql: string; params: unknown[] }> = [];
const db = {
  query: async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    return {
      rows: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          content: "durable recall test memory",
          facets: { semantic: true },
          contracts: { strict_recall_requires_source: true },
          metadata: { test: true },
          salience: 0.75,
          confidence: 0.9,
          recorded_at: "2026-05-14T00:00:00.000Z",
          valid_from: "2026-05-13T00:00:00.000Z",
          valid_to: null,
          provenance: [{ source_kind: "test" }],
          contradictions: [],
        },
      ],
    };
  },
};

async function main() {
  const strict = await recallDurableMemories(db, {
    query: "durable recall",
    mode: "strict",
    at_time: new Date("2026-05-14T00:00:00.000Z"),
    user_id: "durable_user",
    project_id: "durable_project",
    limit: 5,
  });

  if (strict.results[0]?.id !== "22222222-2222-4222-8222-222222222222") {
    throw new Error("strict durable recall did not map rows");
  }

  await recallDurableMemories(db, {
    query: "durable recall",
    mode: "historical",
    at_time: "2026-05-14T00:00:00.000Z",
    limit: 3,
  });

  await recallDurableMemories(db, {
    query: "durable recall",
    mode: "associative",
    limit: 3,
  });

  let invalidModeRejected = false;
  try {
    await recallDurableMemories(db, {
      query: "durable recall",
      mode: "magic" as any,
      limit: 3,
    });
  } catch (err: any) {
    invalidModeRejected = err.message.includes("mode must be strict, historical, or associative");
  }
  if (!invalidModeRejected) {
    throw new Error("durable recall must reject invalid mode");
  }

  const sqlText = calls.map((call) => call.sql).join("\n").toLowerCase();
  if (!sqlText.includes('"public"."memories"')) {
    throw new Error("recall must query durable memories");
  }
  if (!sqlText.includes('"public"."provenance"')) {
    throw new Error("strict recall must include provenance");
  }
  if (!sqlText.includes('"public"."contradictions"')) {
    throw new Error("strict recall must account for contradictions");
  }
  if (!sqlText.includes("valid_from") || !sqlText.includes("valid_to")) {
    throw new Error("recall must apply bitemporal visibility");
  }
  if (!sqlText.includes("recorded_at")) {
    throw new Error("recall must apply recorded_at visibility");
  }

  const strictSql = calls[0].sql.toLowerCase();
  if (!strictSql.includes("jsonb_array_length")) {
    throw new Error("strict recall must require provenance");
  }
  if (!strictSql.includes("open")) {
    throw new Error("strict recall must filter open contradictions");
  }
  if (!strictSql.includes("recall_allowed")) {
    throw new Error("strict recall must enforce recall_allowed contract");
  }

  console.log("[DURABLE] recall contract verified");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
