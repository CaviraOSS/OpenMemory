import {
  buildDurableSchemaSql,
  DURABLE_SCHEMA_VERSION,
  DURABLE_TABLES,
} from "../src/durable/schema";

const requiredTables = [
  "memories",
  "memory_versions",
  "entities",
  "memory_entities",
  "edges",
  "contradictions",
  "provenance",
  "inferences",
  "working_memory",
  "consolidations",
  "audit_log",
];

const sql = buildDurableSchemaSql({ schema: "public", vectorDim: 1536 }).join(
  "\n",
);

for (const table of requiredTables) {
  if (!DURABLE_TABLES.includes(table)) {
    throw new Error(`missing durable table export: ${table}`);
  }
  if (!sql.includes(`"public"."${table}"`)) {
    throw new Error(`missing durable table SQL: ${table}`);
  }
}

for (const column of [
  "valid_from",
  "valid_to",
  "observed_at",
  "recorded_at",
  "superseded_at",
]) {
  if (!sql.includes(column)) {
    throw new Error(`missing bitemporal column: ${column}`);
  }
}

for (const column of ["facets", "contracts", "metadata"]) {
  if (!sql.includes(`${column} jsonb`)) {
    throw new Error(`missing jsonb column: ${column}`);
  }
}

if (!sql.includes("vector(1536)")) {
  throw new Error("durable memory embedding must use configured pgvector dim");
}

if (!sql.includes('"audit_log"')) {
  throw new Error("durable schema must include audit_log");
}

if (!DURABLE_SCHEMA_VERSION.startsWith("2.")) {
  throw new Error(`unexpected durable schema version: ${DURABLE_SCHEMA_VERSION}`);
}

console.log("[DURABLE] schema contract verified");
