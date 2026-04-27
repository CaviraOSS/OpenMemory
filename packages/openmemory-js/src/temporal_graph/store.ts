import { run_async, get_async, all_async } from "../core/db";
import { env } from "../core/cfg";
import { TemporalFact, TemporalEdge } from "./types";
import { randomUUID } from "crypto";

const is_pg = env.metadata_backend === "postgres";

export interface InsertFactOptions {
    subject: string;
    predicate: string;
    object: string;
    valid_from?: Date;
    confidence?: number;
    metadata?: Record<string, any>;
    user_id?: string;
}

export async function insert_fact(opts: InsertFactOptions): Promise<string>;
export async function insert_fact(
    subject: string,
    predicate: string,
    object: string,
    valid_from?: Date,
    confidence?: number,
    metadata?: Record<string, any>,
    user_id?: string,
): Promise<string>;
export async function insert_fact(
    subject_or_opts: string | InsertFactOptions,
    predicate?: string,
    object?: string,
    valid_from?: Date,
    confidence?: number,
    metadata?: Record<string, any>,
    user_id?: string,
): Promise<string> {
    // Normalize options-bag form to the positional locals used by the
    // existing implementation.
    if (typeof subject_or_opts === "object" && subject_or_opts !== null) {
        const opts = subject_or_opts;
        return _insert_fact_impl(
            opts.subject,
            opts.predicate,
            opts.object,
            opts.valid_from ?? new Date(),
            opts.confidence ?? 1.0,
            opts.metadata,
            opts.user_id,
        );
    }
    return _insert_fact_impl(
        subject_or_opts,
        predicate as string,
        object as string,
        valid_from ?? new Date(),
        confidence ?? 1.0,
        metadata,
        user_id,
    );
}

const _insert_fact_impl = async (
    subject: string,
    predicate: string,
    object: string,
    valid_from: Date = new Date(),
    confidence: number = 1.0,
    metadata?: Record<string, any>,
    user_id?: string,
): Promise<string> => {
    const id = randomUUID();
    const now = Date.now();
    const valid_from_ts = valid_from.getTime();

    const existing = await all_async(
        `
        SELECT id, valid_from FROM temporal_facts
        WHERE subject = ? AND predicate = ? AND valid_to IS NULL${user_id ? " AND user_id = ?" : ""}
        ORDER BY valid_from DESC
    `,
        user_id ? [subject, predicate, user_id] : [subject, predicate],
    );

    for (const old of existing) {
        if (old.valid_from < valid_from_ts) {
            await run_async(
                `UPDATE temporal_facts SET valid_to = ? WHERE id = ?`,
                [valid_from_ts - 1, old.id],
            );
            console.error(
                `[TEMPORAL] Closed fact ${old.id} at ${new Date(valid_from_ts - 1).toISOString()}`,
            );
        }
    }

    await run_async(
        `
        INSERT INTO temporal_facts (id, user_id, subject, predicate, object, valid_from, valid_to, confidence, last_updated, metadata)
        VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
    `,
        [
            id,
            user_id || null,
            subject,
            predicate,
            object,
            valid_from_ts,
            confidence,
            now,
            metadata ? JSON.stringify(metadata) : null,
        ],
    );

    console.error(
        `[TEMPORAL] Inserted fact: ${subject} ${predicate} ${object} (from ${valid_from.toISOString()}, confidence=${confidence}${user_id ? `, user=${user_id}` : ""})`,
    );
    return id;
};

export const update_fact = async (
    id: string,
    confidence?: number,
    metadata?: Record<string, any>,
): Promise<void> => {
    const updates: string[] = [];
    const params: any[] = [];

    if (confidence !== undefined) {
        updates.push("confidence = ?");
        params.push(confidence);
    }

    if (metadata !== undefined) {
        updates.push("metadata = ?");
        params.push(JSON.stringify(metadata));
    }

    updates.push("last_updated = ?");
    params.push(Date.now());

    params.push(id);

    if (updates.length > 0) {
        await run_async(
            `UPDATE temporal_facts SET ${updates.join(", ")} WHERE id = ?`,
            params,
        );
        console.error(`[TEMPORAL] Updated fact ${id}`);
    }
};

export const invalidate_fact = async (
    id: string,
    valid_to: Date = new Date(),
): Promise<void> => {
    await run_async(
        `UPDATE temporal_facts SET valid_to = ?, last_updated = ? WHERE id = ?`,
        [valid_to.getTime(), Date.now(), id],
    );
    console.error(
        `[TEMPORAL] Invalidated fact ${id} at ${valid_to.toISOString()}`,
    );
};

export const delete_fact = async (id: string): Promise<void> => {
    await run_async(`DELETE FROM temporal_facts WHERE id = ?`, [id]);
    console.error(`[TEMPORAL] Deleted fact ${id}`);
};

export const insert_edge = async (
    source_id: string,
    target_id: string,
    relation_type: string,
    valid_from: Date = new Date(),
    weight: number = 1.0,
    metadata?: Record<string, any>,
): Promise<string> => {
    const id = randomUUID();
    const valid_from_ts = valid_from.getTime();

    await run_async(
        `
        INSERT INTO temporal_edges (id, source_id, target_id, relation_type, valid_from, valid_to, weight, metadata)
        VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
    `,
        [
            id,
            source_id,
            target_id,
            relation_type,
            valid_from_ts,
            weight,
            metadata ? JSON.stringify(metadata) : null,
        ],
    );

    console.log(
        `[TEMPORAL] Created edge: ${source_id} --[${relation_type}]--> ${target_id}`,
    );
    return id;
};

export const invalidate_edge = async (
    id: string,
    valid_to: Date = new Date(),
): Promise<void> => {
    await run_async(`UPDATE temporal_edges SET valid_to = ? WHERE id = ?`, [
        valid_to.getTime(),
        id,
    ]);
    console.log(`[TEMPORAL] Invalidated edge ${id}`);
};

export const batch_insert_facts = async (
    facts: Array<{
        subject: string;
        predicate: string;
        object: string;
        valid_from?: Date;
        confidence?: number;
        metadata?: Record<string, any>;
    }>,
    user_id?: string,
): Promise<string[]> => {
    const ids: string[] = [];

    await run_async("BEGIN TRANSACTION");
    try {
        for (const fact of facts) {
            const id = await insert_fact(
                fact.subject,
                fact.predicate,
                fact.object,
                fact.valid_from,
                fact.confidence,
                fact.metadata,
                user_id,
            );
            ids.push(id);
        }
        await run_async("COMMIT");
        console.log(`[TEMPORAL] Batch inserted ${ids.length} facts`);
    } catch (error) {
        await run_async("ROLLBACK");
        throw error;
    }

    return ids;
};

export const apply_confidence_decay = async (
    decay_rate: number = 0.01,
): Promise<number> => {
    const now = Date.now();
    const one_day = 86400000;

    // Postgres: use RETURNING 1 and count the rows of the result, since
    // SQLite's connection-scoped `changes()` is unavailable.
    // SQLite: run the UPDATE then read `changes()` from the same connection.
    let changes = 0;

    if (is_pg) {
        // GREATEST is the Postgres analogue of SQLite's MAX(scalar, scalar).
        const rows = await all_async(
            `
            UPDATE temporal_facts
            SET confidence = GREATEST(0.1, confidence * (1 - ? * ((? - valid_from) / ?)))
            WHERE valid_to IS NULL AND confidence > 0.1
            RETURNING 1
        `,
            [decay_rate, now, one_day],
        );
        changes = Array.isArray(rows) ? rows.length : 0;
    } else {
        await run_async(
            `
            UPDATE temporal_facts
            SET confidence = MAX(0.1, confidence * (1 - ? * ((? - valid_from) / ?)))
            WHERE valid_to IS NULL AND confidence > 0.1
        `,
            [decay_rate, now, one_day],
        );
        const result = (await get_async(`SELECT changes() as changes`)) as any;
        changes = result?.changes || 0;
    }

    console.log(`[TEMPORAL] Applied confidence decay to ${changes} facts`);
    return changes;
};

export const get_active_facts_count = async (): Promise<number> => {
    const result = (await get_async(
        `SELECT COUNT(*) as count FROM temporal_facts WHERE valid_to IS NULL`,
    )) as any;
    return result?.count || 0;
};

export const get_total_facts_count = async (): Promise<number> => {
    const result = (await get_async(
        `SELECT COUNT(*) as count FROM temporal_facts`,
    )) as any;
    return result?.count || 0;
};

/**
 * Authenticated point-lookup for a single fact. Returns null if the fact
 * either does not exist or belongs to a different tenant. This is the
 * preferred way for route handlers to confirm ownership before mutating
 * a fact, replacing the old `query_facts_at_time(...).find(id)` pattern
 * which fetched the caller's entire history just to authorize one row.
 */
export const get_fact_by_id_for_user = async (
    id: string,
    user_id: string,
): Promise<TemporalFact | null> => {
    const row = await get_async(
        `SELECT id, user_id, subject, predicate, object, valid_from, valid_to, confidence, last_updated, metadata
         FROM temporal_facts WHERE id = ? AND user_id = ? LIMIT 1`,
        [id, user_id],
    );
    if (!row) return null;
    return {
        id: row.id,
        user_id: row.user_id,
        subject: row.subject,
        predicate: row.predicate,
        object: row.object,
        valid_from: new Date(row.valid_from),
        valid_to: row.valid_to ? new Date(row.valid_to) : null,
        confidence: row.confidence,
        last_updated: new Date(row.last_updated),
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
};
