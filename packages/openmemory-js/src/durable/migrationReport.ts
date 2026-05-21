type LegacyMemoryRow = {
  id?: string;
  content?: string;
  primary_sector?: string;
  tags?: string | string[];
  meta?: string | Record<string, unknown> | null;
  created_at?: string | number | Date;
};

type LegacyMigrationInput = {
  memories?: LegacyMemoryRow[];
  waypoints?: unknown[];
  temporal_facts?: unknown[];
};

const parseJson = (value: unknown, fallback: unknown) => {
  if (typeof value !== "string") return value ?? fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

export function normalizeLegacyMemoryRow(row: LegacyMemoryRow) {
  const tags = parseJson(row.tags, []);
  const metadata = parseJson(row.meta, {});
  const facets: Record<string, unknown> = {};
  if (row.primary_sector) facets[row.primary_sector] = true;
  if (Array.isArray(tags)) facets.tags = tags;

  return {
    id: row.id,
    content: row.content || "",
    facets,
    metadata:
      metadata && typeof metadata === "object" && !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>)
        : {},
    bitemporal: {
      observed_at:
        row.created_at === undefined
          ? null
          : new Date(row.created_at).toISOString(),
    },
  };
}

export function buildLegacyMigrationReport(input: LegacyMigrationInput) {
  const memories = input.memories || [];
  const waypoints = input.waypoints || [];
  const temporalFacts = input.temporal_facts || [];
  return {
    destructive: false,
    counts: {
      memories: memories.length,
      edges: waypoints.length,
      temporal_facts: temporalFacts.length,
      skipped: memories.filter((row) => !row.content?.trim()).length,
    },
    warnings: memories.some((row) => !row.id)
      ? ["some legacy memories have no id and need generated ids"]
      : [],
    mapped_memories: memories.map(normalizeLegacyMemoryRow),
  };
}
