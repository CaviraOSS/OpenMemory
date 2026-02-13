/**
 * Citation Tracking & Reference Graph (D2)
 *
 * Extracts and normalizes citations from text, supporting:
 * - Legal citations (case law, legislation, regulations)
 * - Academic citations (author-date, footnotes)
 * - URLs and web references
 * - Internal cross-references
 */

import { v4 as uuid } from "uuid";
import { run_async, get_async, all_async } from "./db";

export type CitationType =
    | "case_law"      // Court cases
    | "legislation"   // Acts, statutes
    | "regulation"    // Rules, regulations
    | "academic"      // Journal articles, books
    | "url"           // Web references
    | "internal"      // Cross-references to other memories
    | "other";

export interface Citation {
    id: string;
    raw_text: string;           // Original citation text
    normalized: string;         // Standardized form
    citation_type: CitationType;
    source_id?: string;         // ID of source document/memory
    target_id?: string;         // ID of target if internal ref
    metadata: {
        parties?: string[];     // For case citations
        year?: number;
        court?: string;
        volume?: string;
        page?: string;
        title?: string;
        authors?: string[];
        url?: string;
        [key: string]: any;
    };
    created_at: number;
}

export interface CitationEdge {
    id: string;
    source_memory_id: string;
    citation_id: string;
    position: number;           // Position in source text
    context: string;            // Surrounding text
    created_at: number;
}

// Citation patterns - ordered by specificity
const CITATION_PATTERNS: { type: CitationType; patterns: RegExp[]; extract: (match: RegExpMatchArray) => Partial<Citation["metadata"]> }[] = [
    // Australian case citations: Smith v Jones [2020] HCA 1 or Smith v. Jones [2020] HCA 1
    {
        type: "case_law",
        patterns: [
            /\b([A-Z][a-zA-Z\s&]+)\s+v\.?\s+([A-Z][a-zA-Z\s&]+)\s+\[(\d{4})\]\s+([A-Z]+)\s+(\d+)/g,
            /\b([A-Z][a-zA-Z\s&]+)\s+v\.?\s+([A-Z][a-zA-Z\s&]+)\s+\((\d{4})\)\s+(\d+)\s+([A-Z]+)\s+(\d+)/g,
        ],
        extract: (m) => ({
            parties: [m[1]?.trim(), m[2]?.trim()].filter(Boolean),
            year: m[3] ? parseInt(m[3], 10) : undefined,
            court: m[4],
            volume: m[5] || m[4],
            page: m[6] || m[5],
        }),
    },
    // US case citations: Smith v. Jones, 123 F.3d 456 (9th Cir. 2020)
    {
        type: "case_law",
        patterns: [
            /\b([A-Z][a-zA-Z\s&]+)\s+v\.?\s+([A-Z][a-zA-Z\s&]+),\s+(\d+)\s+([A-Z][a-z.]+(?:\s*\d+[a-z]*)?)\s+(\d+)\s+\(([^)]+)\s+(\d{4})\)/g,
        ],
        extract: (m) => ({
            parties: [m[1]?.trim(), m[2]?.trim()].filter(Boolean),
            volume: m[3],
            court: m[4] + " (" + m[6] + ")",
            page: m[5],
            year: m[7] ? parseInt(m[7], 10) : undefined,
        }),
    },
    // Legislation: Competition and Consumer Act 2010 (Cth) s 18
    {
        type: "legislation",
        patterns: [
            /\b([A-Z][a-zA-Z\s]+(?:Act|Law|Code|Ordinance))\s+(\d{4})\s*\(([A-Za-z]+)\)\s*(?:s(?:ection)?\.?\s*(\d+[A-Za-z]*))?/gi,
            /\b([A-Z][a-zA-Z\s]+(?:Act|Law|Code|Ordinance))\s+(\d{4})\s*(?:s(?:ection)?\.?\s*(\d+[A-Za-z]*))?/gi,
        ],
        extract: (m) => ({
            title: m[1]?.trim(),
            year: m[2] ? parseInt(m[2], 10) : undefined,
            court: m[3],  // jurisdiction for legislation
            page: m[4] || m[3],  // section number
        }),
    },
    // Academic citations: Author (Year)
    {
        type: "academic",
        patterns: [
            /\b([A-Z][a-z]+(?:\s+(?:and|&)\s+[A-Z][a-z]+)?)\s+\((\d{4})\)/g,
            /\b([A-Z][a-z]+)\s+et\s+al\.?\s+\((\d{4})\)/gi,
        ],
        extract: (m) => ({
            authors: [m[1]?.trim()],
            year: m[2] ? parseInt(m[2], 10) : undefined,
        }),
    },
    // Footnote references: [1], (1), ¹
    {
        type: "academic",
        patterns: [
            /\[(\d{1,3})\]/g,
            /\((\d{1,3})\)(?=\s|$)/g,
            /[¹²³⁴⁵⁶⁷⁸⁹⁰]+/g,
        ],
        extract: (m) => ({
            volume: m[1] || m[0],
        }),
    },
    // URLs
    {
        type: "url",
        patterns: [
            /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi,
        ],
        extract: (m) => ({
            url: m[0],
        }),
    },
];

/**
 * Extract all citations from text
 */
export function extract_citations(text: string, source_id?: string): Citation[] {
    const citations: Citation[] = [];
    const seen = new Set<string>();

    for (const { type, patterns, extract } of CITATION_PATTERNS) {
        for (const pattern of patterns) {
            // Reset regex state
            pattern.lastIndex = 0;
            let match: RegExpExecArray | null;

            while ((match = pattern.exec(text)) !== null) {
                const raw_text = match[0].trim();
                const normalized = normalize_citation(raw_text, type);

                // Deduplicate by normalized form
                if (seen.has(normalized)) continue;
                seen.add(normalized);

                const metadata = extract(match);

                citations.push({
                    id: uuid(),
                    raw_text,
                    normalized,
                    citation_type: type,
                    source_id,
                    metadata,
                    created_at: Date.now(),
                });
            }
        }
    }

    return citations;
}

/**
 * Normalize a citation to standard form
 */
function normalize_citation(raw: string, type: CitationType): string {
    let normalized = raw.trim();

    switch (type) {
        case "case_law":
            // Standardize "v" vs "v."
            normalized = normalized.replace(/\s+v\.?\s+/gi, " v ");
            // Remove extra whitespace
            normalized = normalized.replace(/\s+/g, " ");
            break;

        case "legislation":
            // Remove section references for base normalization
            normalized = normalized.replace(/\s*s(?:ection)?\.?\s*\d+[A-Za-z]*/gi, "");
            normalized = normalized.replace(/\s+/g, " ").trim();
            break;

        case "url":
            // Remove trailing punctuation, fragments
            normalized = normalized.replace(/[.,;:!?]+$/, "");
            break;

        default:
            normalized = normalized.replace(/\s+/g, " ").trim();
    }

    return normalized;
}

/**
 * Get context around a citation match (surrounding text)
 */
function get_citation_context(text: string, match_start: number, match_end: number, context_chars = 100): string {
    const start = Math.max(0, match_start - context_chars);
    const end = Math.min(text.length, match_end + context_chars);

    let context = text.substring(start, end);
    if (start > 0) context = "..." + context;
    if (end < text.length) context = context + "...";

    return context.trim();
}

// Database operations
const is_pg = process.env.OM_METADATA_BACKEND === "postgres";
const sc = process.env.OM_PG_SCHEMA || "public";

/**
 * Store citations in the database
 */
export async function store_citations(
    memory_id: string,
    citations: Citation[],
    text: string
): Promise<void> {
    for (const citation of citations) {
        // Store citation
        const citation_sql = is_pg
            ? `INSERT INTO "${sc}"."openmemory_citations"(id, raw_text, normalized, citation_type, metadata, created_at)
               VALUES($1, $2, $3, $4, $5, $6)
               ON CONFLICT(normalized) DO UPDATE SET metadata = EXCLUDED.metadata`
            : `INSERT OR REPLACE INTO citations(id, raw_text, normalized, citation_type, metadata, created_at)
               VALUES(?, ?, ?, ?, ?, ?)`;

        await run_async(citation_sql, [
            citation.id,
            citation.raw_text,
            citation.normalized,
            citation.citation_type,
            JSON.stringify(citation.metadata),
            citation.created_at,
        ]);

        // Find position and store edge
        const position = text.indexOf(citation.raw_text);
        const context = get_citation_context(
            text,
            position,
            position + citation.raw_text.length
        );

        const edge_sql = is_pg
            ? `INSERT INTO "${sc}"."openmemory_citation_edges"(id, source_memory_id, citation_id, position, context, created_at)
               VALUES($1, $2, $3, $4, $5, $6)
               ON CONFLICT(source_memory_id, citation_id) DO UPDATE SET position = EXCLUDED.position, context = EXCLUDED.context`
            : `INSERT OR REPLACE INTO citation_edges(id, source_memory_id, citation_id, position, context, created_at)
               VALUES(?, ?, ?, ?, ?, ?)`;

        await run_async(edge_sql, [
            uuid(),
            memory_id,
            citation.id,
            position,
            context,
            Date.now(),
        ]);
    }
}

/**
 * Get all citations for a memory
 */
export async function get_citations_for_memory(memory_id: string): Promise<Citation[]> {
    const sql = is_pg
        ? `SELECT c.* FROM "${sc}"."openmemory_citations" c
           JOIN "${sc}"."openmemory_citation_edges" e ON c.id = e.citation_id
           WHERE e.source_memory_id = $1
           ORDER BY e.position`
        : `SELECT c.* FROM citations c
           JOIN citation_edges e ON c.id = e.citation_id
           WHERE e.source_memory_id = ?
           ORDER BY e.position`;

    const rows = await all_async(sql, [memory_id]);
    return rows.map(row => ({
        ...row,
        metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata,
    }));
}

/**
 * Find all memories that cite a given reference
 */
export async function find_memories_by_citation(
    normalized_citation: string,
    citation_type?: CitationType
): Promise<Array<{ memory_id: string; position: number; context: string }>> {
    let sql = is_pg
        ? `SELECT e.source_memory_id as memory_id, e.position, e.context
           FROM "${sc}"."openmemory_citation_edges" e
           JOIN "${sc}"."openmemory_citations" c ON c.id = e.citation_id
           WHERE c.normalized ILIKE $1`
        : `SELECT e.source_memory_id as memory_id, e.position, e.context
           FROM citation_edges e
           JOIN citations c ON c.id = e.citation_id
           WHERE c.normalized LIKE ?`;

    const params: any[] = [is_pg ? `%${normalized_citation}%` : `%${normalized_citation}%`];

    if (citation_type) {
        sql += is_pg ? ` AND c.citation_type = $2` : ` AND c.citation_type = ?`;
        params.push(citation_type);
    }

    return all_async(sql, params);
}

/**
 * Get citation statistics for a memory or all memories
 */
export async function get_citation_stats(memory_id?: string): Promise<{
    total_citations: number;
    by_type: Record<CitationType, number>;
    top_cited: Array<{ normalized: string; count: number }>;
}> {
    let total_sql: string;
    let by_type_sql: string;
    let top_sql: string;
    const params = memory_id ? [memory_id] : [];

    if (is_pg) {
        const where = memory_id
            ? `WHERE e.source_memory_id = $1`
            : "";

        total_sql = `SELECT COUNT(DISTINCT c.id) as total
                     FROM "${sc}"."openmemory_citations" c
                     ${memory_id ? `JOIN "${sc}"."openmemory_citation_edges" e ON c.id = e.citation_id ${where}` : ""}`;

        by_type_sql = `SELECT c.citation_type, COUNT(DISTINCT c.id) as count
                       FROM "${sc}"."openmemory_citations" c
                       ${memory_id ? `JOIN "${sc}"."openmemory_citation_edges" e ON c.id = e.citation_id ${where}` : ""}
                       GROUP BY c.citation_type`;

        top_sql = `SELECT c.normalized, COUNT(e.id) as count
                   FROM "${sc}"."openmemory_citations" c
                   JOIN "${sc}"."openmemory_citation_edges" e ON c.id = e.citation_id
                   ${where}
                   GROUP BY c.normalized
                   ORDER BY count DESC
                   LIMIT 10`;
    } else {
        const where = memory_id
            ? `WHERE e.source_memory_id = ?`
            : "";

        total_sql = `SELECT COUNT(DISTINCT c.id) as total
                     FROM citations c
                     ${memory_id ? `JOIN citation_edges e ON c.id = e.citation_id ${where}` : ""}`;

        by_type_sql = `SELECT c.citation_type, COUNT(DISTINCT c.id) as count
                       FROM citations c
                       ${memory_id ? `JOIN citation_edges e ON c.id = e.citation_id ${where}` : ""}
                       GROUP BY c.citation_type`;

        top_sql = `SELECT c.normalized, COUNT(e.id) as count
                   FROM citations c
                   JOIN citation_edges e ON c.id = e.citation_id
                   ${where}
                   GROUP BY c.normalized
                   ORDER BY count DESC
                   LIMIT 10`;
    }

    const [total_row, type_rows, top_rows] = await Promise.all([
        get_async(total_sql, params),
        all_async(by_type_sql, params),
        all_async(top_sql, params),
    ]);

    const by_type: Record<CitationType, number> = {
        case_law: 0,
        legislation: 0,
        regulation: 0,
        academic: 0,
        url: 0,
        internal: 0,
        other: 0,
    };

    for (const row of type_rows) {
        by_type[row.citation_type as CitationType] = row.count;
    }

    return {
        total_citations: total_row?.total || 0,
        by_type,
        top_cited: top_rows.map(r => ({ normalized: r.normalized, count: r.count })),
    };
}

/**
 * Delete citations for a memory (used when memory is deleted)
 */
export async function delete_citations_for_memory(memory_id: string): Promise<void> {
    const edge_sql = is_pg
        ? `DELETE FROM "${sc}"."openmemory_citation_edges" WHERE source_memory_id = $1`
        : `DELETE FROM citation_edges WHERE source_memory_id = ?`;

    await run_async(edge_sql, [memory_id]);

    // Clean up orphaned citations (no edges pointing to them)
    const cleanup_sql = is_pg
        ? `DELETE FROM "${sc}"."openmemory_citations" c
           WHERE NOT EXISTS (SELECT 1 FROM "${sc}"."openmemory_citation_edges" e WHERE e.citation_id = c.id)`
        : `DELETE FROM citations
           WHERE id NOT IN (SELECT citation_id FROM citation_edges)`;

    await run_async(cleanup_sql, []);
}
