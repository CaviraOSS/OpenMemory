/**
 * Clause Similarity Detection (D8)
 *
 * Segments documents into clauses, computes embeddings, and enables
 * similarity search across clauses from different documents.
 */

import { run_async, get_async, all_async, vector_store } from "./db";
import { embed_advanced } from "../memory/embed";
import { rid } from "../utils";

export interface Clause {
    id: string;
    memory_id: string;
    clause_number: number;
    clause_type: ClauseType;
    heading?: string;
    content: string;
    start_position: number;
    end_position: number;
    word_count: number;
    created_at: number;
}

export type ClauseType =
    | "definition"
    | "obligation"
    | "representation"
    | "warranty"
    | "indemnity"
    | "termination"
    | "confidentiality"
    | "intellectual_property"
    | "limitation_of_liability"
    | "dispute_resolution"
    | "general"
    | "preamble"
    | "recital";

export interface ClauseSimilarity {
    clause_id: string;
    memory_id: string;
    clause_number: number;
    heading?: string;
    content: string;
    clause_type: ClauseType;
    similarity: number;
}

// Patterns to detect clause types
const CLAUSE_TYPE_PATTERNS: Record<ClauseType, RegExp> = {
    definition: /\b(?:definitions?|interpretation|defined\s+terms?)\b/i,
    obligation: /\b(?:shall|must|agrees?\s+to|undertakes?\s+to|covenants?\s+to)\b/i,
    representation: /\b(?:represents?|represent(?:s|ed|ing)?)\b/i,
    warranty: /\b(?:warrants?|warrant(?:s|ed|ing)?|warranties)\b/i,
    indemnity: /\b(?:indemnif(?:y|ies|ied|ication)|hold\s+harmless)\b/i,
    termination: /\b(?:terminat(?:e|es|ed|ion)|expir(?:e|es|ed|ation)|cancellation)\b/i,
    confidentiality: /\b(?:confidential(?:ity)?|non-disclosure|proprietary|trade\s+secret)\b/i,
    intellectual_property: /\b(?:intellectual\s+property|copyright|trademark|patent|license)\b/i,
    limitation_of_liability: /\b(?:limit(?:ed|ation)?\s+(?:of\s+)?liabilit(?:y|ies)|consequential\s+damages|indirect\s+damages)\b/i,
    dispute_resolution: /\b(?:dispute|arbitration|mediation|jurisdiction|governing\s+law|choice\s+of\s+law)\b/i,
    preamble: /\b(?:whereas|recitals?|background|introduction)\b/i,
    recital: /\b(?:whereas|recitals?)\b/i,
    general: /./,  // Fallback - matches everything
};

// Patterns to detect clause boundaries
const CLAUSE_BOUNDARY_PATTERNS = [
    // Numbered clauses: "1.", "1.1", "1.1.1", "A.", "(a)", "(i)"
    /^(?:\d+\.)+\s+[A-Z]/gm,
    /^(?:[A-Z]\.|\([a-z]\)|\([ivxlcdm]+\))\s+[A-Z]/gm,
    // Section headers in caps or title case
    /^(?:[A-Z][A-Z\s]+:|\d+\.\s+[A-Z][A-Za-z\s]+$)/gm,
    // Common clause headers
    /^(?:ARTICLE|SECTION|CLAUSE|SCHEDULE|EXHIBIT)\s+[A-Z0-9]/gim,
];

/**
 * Segment document into clauses
 */
export function segment_into_clauses(text: string, memory_id: string): Clause[] {
    const clauses: Clause[] = [];
    const lines = text.split("\n");

    let current_clause: Partial<Clause> | null = null;
    let current_content: string[] = [];
    let clause_number = 0;
    let position = 0;

    for (const line of lines) {
        const trimmed = line.trim();
        const line_length = line.length + 1; // +1 for newline

        // Check if this line starts a new clause
        const is_clause_header = is_clause_boundary(trimmed);

        if (is_clause_header && trimmed.length > 0) {
            // Save previous clause if exists
            if (current_clause && current_content.length > 0) {
                const content = current_content.join("\n").trim();
                if (content.length > 20) {  // Minimum clause length
                    clauses.push({
                        id: rid(),
                        memory_id,
                        clause_number,
                        clause_type: detect_clause_type(content, current_clause.heading),
                        heading: current_clause.heading,
                        content,
                        start_position: current_clause.start_position!,
                        end_position: position - 1,
                        word_count: content.split(/\s+/).length,
                        created_at: Date.now(),
                    });
                    clause_number++;
                }
            }

            // Start new clause
            current_clause = {
                heading: trimmed.substring(0, 100),
                start_position: position,
            };
            current_content = [trimmed];
        } else if (current_clause) {
            // Continue current clause
            current_content.push(line);
        } else if (trimmed.length > 0) {
            // Start first clause (preamble)
            current_clause = {
                heading: "Preamble",
                start_position: position,
            };
            current_content = [line];
        }

        position += line_length;
    }

    // Save final clause
    if (current_clause && current_content.length > 0) {
        const content = current_content.join("\n").trim();
        if (content.length > 20) {
            clauses.push({
                id: rid(),
                memory_id,
                clause_number,
                clause_type: detect_clause_type(content, current_clause.heading),
                heading: current_clause.heading,
                content,
                start_position: current_clause.start_position!,
                end_position: position - 1,
                word_count: content.split(/\s+/).length,
                created_at: Date.now(),
            });
        }
    }

    return clauses;
}

/**
 * Check if a line represents a clause boundary
 */
function is_clause_boundary(line: string): boolean {
    if (line.length === 0) return false;

    // Check numbered clauses
    if (/^\d+\.(\d+\.)*\s+[A-Z]/.test(line)) return true;
    if (/^[A-Z]\.\s+[A-Z]/.test(line)) return true;
    if (/^\([a-z]\)\s+[A-Z]/.test(line)) return true;
    if (/^\([ivxlcdm]+\)\s+[A-Z]/i.test(line)) return true;

    // Check section headers
    if (/^(ARTICLE|SECTION|CLAUSE|SCHEDULE|EXHIBIT)\s+/i.test(line)) return true;

    // Check all-caps headers (but not single words)
    if (/^[A-Z][A-Z\s]{10,}$/.test(line) && line.includes(" ")) return true;

    return false;
}

/**
 * Detect the type of a clause based on content
 */
function detect_clause_type(content: string, heading?: string): ClauseType {
    const text_to_check = (heading || "") + " " + content.substring(0, 500);

    // Check in order of specificity
    const types: ClauseType[] = [
        "indemnity",
        "limitation_of_liability",
        "intellectual_property",
        "confidentiality",
        "termination",
        "dispute_resolution",
        "definition",
        "warranty",
        "representation",
        "obligation",
        "preamble",
        "recital",
    ];

    for (const type of types) {
        if (CLAUSE_TYPE_PATTERNS[type].test(text_to_check)) {
            return type;
        }
    }

    return "general";
}

// Database operations
const is_pg = process.env.OM_METADATA_BACKEND === "postgres";
const sc = process.env.OM_PG_SCHEMA || "public";

/**
 * Store clauses and their embeddings
 */
export async function store_clauses(clauses: Clause[], user_id?: string): Promise<void> {
    if (clauses.length === 0) return;

    // Store all clause metadata first
    for (const clause of clauses) {
        const sql = is_pg
            ? `INSERT INTO "${sc}"."openmemory_clauses"(id, memory_id, clause_number, clause_type, heading, content, start_position, end_position, word_count, created_at)
               VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
               ON CONFLICT(id) DO UPDATE SET content = EXCLUDED.content, heading = EXCLUDED.heading`
            : `INSERT OR REPLACE INTO clauses(id, memory_id, clause_number, clause_type, heading, content, start_position, end_position, word_count, created_at)
               VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        await run_async(sql, [
            clause.id,
            clause.memory_id,
            clause.clause_number,
            clause.clause_type,
            clause.heading,
            clause.content,
            clause.start_position,
            clause.end_position,
            clause.word_count,
            clause.created_at,
        ]);
    }

    // Batch compute embeddings for all clauses at once
    // Use truncated version for embedding (first 1000 chars)
    const embed_texts = clauses.map(clause =>
        (clause.heading ? clause.heading + ": " : "") + clause.content.substring(0, 1000)
    );

    try {
        const vectors = await embed_advanced(embed_texts, "semantic", user_id);
        if (vectors && vectors.length > 0) {
            // Store each embedding with its corresponding clause ID
            for (let i = 0; i < clauses.length && i < vectors.length; i++) {
                await vector_store.storeVector(
                    clauses[i].id,
                    "semantic",
                    vectors[i],
                    vectors[i].length,
                    user_id
                );
            }
        }
    } catch (e) {
        console.error("[clause_similarity] batch embedding failed:", e);
    }
}

/**
 * Find similar clauses to a given clause or text
 */
export async function find_similar_clauses(
    query: string | Clause,
    options: {
        k?: number;
        threshold?: number;
        exclude_memory_id?: string;
        clause_type?: ClauseType;
        user_id?: string;
    } = {}
): Promise<ClauseSimilarity[]> {
    const {
        k = 10,
        threshold = 0.7,
        exclude_memory_id,
        clause_type,
        user_id,
    } = options;

    // Get query text
    const query_text = typeof query === "string"
        ? query
        : (query.heading ? query.heading + ": " : "") + query.content.substring(0, 1000);

    // Compute query embedding
    const vectors = await embed_advanced([query_text], "semantic", user_id);
    if (!vectors || vectors.length === 0) {
        return [];
    }

    // Search for similar vectors
    const similar = await vector_store.searchSimilar("semantic", vectors[0], k * 2, user_id);

    // Fetch clause details for matches
    const results: ClauseSimilarity[] = [];

    for (const match of similar) {
        if (match.score < threshold) continue;

        // Get clause details
        const clause_sql = is_pg
            ? `SELECT * FROM "${sc}"."openmemory_clauses" WHERE id = $1`
            : `SELECT * FROM clauses WHERE id = ?`;

        const clause = await get_async(clause_sql, [match.id]);
        if (!clause) continue;

        // Apply filters
        if (exclude_memory_id && clause.memory_id === exclude_memory_id) continue;
        if (clause_type && clause.clause_type !== clause_type) continue;

        // Skip if this is the same clause we're querying
        if (typeof query !== "string" && query.id === clause.id) continue;

        results.push({
            clause_id: clause.id,
            memory_id: clause.memory_id,
            clause_number: clause.clause_number,
            heading: clause.heading,
            content: clause.content,
            clause_type: clause.clause_type,
            similarity: match.score,
        });

        if (results.length >= k) break;
    }

    return results;
}

/**
 * Get all clauses for a memory
 */
export async function get_clauses_for_memory(memory_id: string): Promise<Clause[]> {
    const sql = is_pg
        ? `SELECT * FROM "${sc}"."openmemory_clauses" WHERE memory_id = $1 ORDER BY clause_number`
        : `SELECT * FROM clauses WHERE memory_id = ? ORDER BY clause_number`;

    return all_async(sql, [memory_id]);
}

/**
 * Delete clauses for a memory
 */
export async function delete_clauses_for_memory(memory_id: string): Promise<void> {
    // Get clause IDs first for vector cleanup
    const clauses = await get_clauses_for_memory(memory_id);

    // Delete from database
    const sql = is_pg
        ? `DELETE FROM "${sc}"."openmemory_clauses" WHERE memory_id = $1`
        : `DELETE FROM clauses WHERE memory_id = ?`;

    await run_async(sql, [memory_id]);

    // Note: Vector cleanup would need to be handled by the vector store
    // For now, orphaned vectors will be cleaned up on next rebuild
}

/**
 * Get clause statistics
 */
export async function get_clause_stats(memory_id?: string): Promise<{
    total_clauses: number;
    by_type: Record<ClauseType, number>;
    avg_word_count: number;
}> {
    let sql: string;
    const params = memory_id ? [memory_id] : [];

    if (is_pg) {
        const where = memory_id ? `WHERE memory_id = $1` : "";
        sql = `SELECT
                 COUNT(*) as total,
                 clause_type,
                 AVG(word_count) as avg_words
               FROM "${sc}"."openmemory_clauses"
               ${where}
               GROUP BY clause_type`;
    } else {
        const where = memory_id ? `WHERE memory_id = ?` : "";
        sql = `SELECT
                 COUNT(*) as total,
                 clause_type,
                 AVG(word_count) as avg_words
               FROM clauses
               ${where}
               GROUP BY clause_type`;
    }

    const rows = await all_async(sql, params);

    const by_type: Record<ClauseType, number> = {
        definition: 0,
        obligation: 0,
        representation: 0,
        warranty: 0,
        indemnity: 0,
        termination: 0,
        confidentiality: 0,
        intellectual_property: 0,
        limitation_of_liability: 0,
        dispute_resolution: 0,
        general: 0,
        preamble: 0,
        recital: 0,
    };

    let total = 0;
    let total_avg = 0;

    for (const row of rows) {
        by_type[row.clause_type as ClauseType] = row.total;
        total += row.total;
        total_avg += (row.avg_words || 0) * row.total;
    }

    return {
        total_clauses: total,
        by_type,
        avg_word_count: total > 0 ? Math.round(total_avg / total) : 0,
    };
}
