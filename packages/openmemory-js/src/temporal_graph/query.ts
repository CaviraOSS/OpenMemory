import { get_async, all_async } from "../core/db";
import { TemporalFact, TemporalQuery, TimelineEntry } from "./types";

export const query_facts_at_time = async (
    subject?: string,
    predicate?: string,
    object?: string,
    at: Date = new Date(),
    min_confidence: number = 0.1,
    user_id?: string,
): Promise<TemporalFact[]> => {
    const timestamp = at.getTime();
    const conditions: string[] = [];
    const params: any[] = [];

    conditions.push(
        "(valid_from <= ? AND (valid_to IS NULL OR valid_to >= ?))",
    );
    params.push(timestamp, timestamp);

    if (user_id) {
        conditions.push("user_id = ?");
        params.push(user_id);
    }

    if (subject) {
        conditions.push("subject = ?");
        params.push(subject);
    }

    if (predicate) {
        conditions.push("predicate = ?");
        params.push(predicate);
    }

    if (object) {
        conditions.push("object = ?");
        params.push(object);
    }

    if (min_confidence > 0) {
        conditions.push("confidence >= ?");
        params.push(min_confidence);
    }

    const sql = `
        SELECT id, user_id, subject, predicate, object, valid_from, valid_to, confidence, last_updated, metadata
        FROM temporal_facts
        WHERE ${conditions.join(" AND ")}
        ORDER BY confidence DESC, valid_from DESC
    `;

    const rows = await all_async(sql, params);
    return rows.map((row) => ({
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
    }));
};

export const get_current_fact = async (
    subject: string,
    predicate: string,
    user_id?: string,
): Promise<TemporalFact | null> => {
    const now = Date.now();

    const row = await get_async(
        `
        SELECT id, user_id, subject, predicate, object, valid_from, valid_to, confidence, last_updated, metadata
        FROM temporal_facts
        WHERE subject = ? AND predicate = ? AND valid_to IS NULL${user_id ? " AND user_id = ?" : ""}
        ORDER BY valid_from DESC
        LIMIT 1
    `,
        user_id ? [subject, predicate, user_id] : [subject, predicate],
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

export const query_facts_in_range = async (opts: {
    user_id: string;
    subject?: string;
    predicate?: string;
    from?: Date;
    to?: Date;
    min_confidence?: number;
}): Promise<TemporalFact[]> => {
    const {
        user_id,
        subject,
        predicate,
        from,
        to,
        min_confidence = 0.1,
    } = opts;
    const conditions: string[] = [];
    const params: any[] = [];

    if (from && to) {
        const from_ts = from.getTime();
        const to_ts = to.getTime();
        conditions.push(
            "((valid_from <= ? AND (valid_to IS NULL OR valid_to >= ?)) OR (valid_from >= ? AND valid_from <= ?))",
        );
        params.push(to_ts, from_ts, from_ts, to_ts);
    } else if (from) {
        conditions.push("valid_from >= ?");
        params.push(from.getTime());
    } else if (to) {
        conditions.push("valid_from <= ?");
        params.push(to.getTime());
    }

    conditions.push("user_id = ?");
    params.push(user_id);

    if (subject) {
        conditions.push("subject = ?");
        params.push(subject);
    }

    if (predicate) {
        conditions.push("predicate = ?");
        params.push(predicate);
    }

    if (min_confidence > 0) {
        conditions.push("confidence >= ?");
        params.push(min_confidence);
    }

    const where =
        conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const sql = `
        SELECT id, user_id, subject, predicate, object, valid_from, valid_to, confidence, last_updated, metadata
        FROM temporal_facts
        ${where}
        ORDER BY valid_from DESC
    `;

    const rows = await all_async(sql, params);
    return rows.map((row) => ({
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
    }));
};

export const find_conflicting_facts = async (opts: {
    user_id: string;
    subject: string;
    predicate: string;
    at?: Date;
}): Promise<TemporalFact[]> => {
    const { user_id, subject, predicate, at } = opts;
    const timestamp = at ? at.getTime() : Date.now();

    const rows = await all_async(
        `
        SELECT id, user_id, subject, predicate, object, valid_from, valid_to, confidence, last_updated, metadata
        FROM temporal_facts
        WHERE subject = ? AND predicate = ? AND user_id = ?
        AND (valid_from <= ? AND (valid_to IS NULL OR valid_to >= ?))
        ORDER BY confidence DESC
    `,
        [subject, predicate, user_id, timestamp, timestamp],
    );

    return rows.map((row) => ({
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
    }));
};

export const get_facts_by_subject = async (
    subject: string,
    opts: { user_id: string; at?: Date; include_historical?: boolean },
): Promise<TemporalFact[]> => {
    const { user_id, at, include_historical = false } = opts;
    let sql: string;
    let params: any[];

    if (include_historical) {
        sql = `
            SELECT id, user_id, subject, predicate, object, valid_from, valid_to, confidence, last_updated, metadata
            FROM temporal_facts
            WHERE subject = ? AND user_id = ?
            ORDER BY predicate ASC, valid_from DESC
        `;
        params = [subject, user_id];
    } else {
        const timestamp = at ? at.getTime() : Date.now();
        sql = `
            SELECT id, user_id, subject, predicate, object, valid_from, valid_to, confidence, last_updated, metadata
            FROM temporal_facts
            WHERE subject = ? AND user_id = ?
            AND (valid_from <= ? AND (valid_to IS NULL OR valid_to >= ?))
            ORDER BY predicate ASC, confidence DESC
        `;
        params = [subject, user_id, timestamp, timestamp];
    }

    const rows = await all_async(sql, params);
    return rows.map((row) => ({
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
    }));
};

export const search_facts = async (
    pattern: string,
    opts: {
        user_id: string;
        field?: "subject" | "predicate" | "object";
        at?: Date;
    },
): Promise<TemporalFact[]> => {
    const { user_id, field = "subject", at } = opts;
    const timestamp = at ? at.getTime() : Date.now();
    const search_pattern = `%${pattern}%`;

    const sql = `
        SELECT id, user_id, subject, predicate, object, valid_from, valid_to, confidence, last_updated, metadata
        FROM temporal_facts
        WHERE ${field} LIKE ? AND user_id = ?
        AND (valid_from <= ? AND (valid_to IS NULL OR valid_to >= ?))
        ORDER BY confidence DESC, valid_from DESC
        LIMIT 100
    `;

    const rows = await all_async(sql, [
        search_pattern,
        user_id,
        timestamp,
        timestamp,
    ]);
    return rows.map((row) => ({
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
    }));
};

export const get_related_facts = async (
    fact_id: string,
    opts: { user_id: string; relation_type?: string; at?: Date },
): Promise<Array<{ fact: TemporalFact; relation: string; weight: number }>> => {
    const { user_id, relation_type, at } = opts;
    const timestamp = at ? at.getTime() : Date.now();
    const conditions = [
        "(e.valid_from <= ? AND (e.valid_to IS NULL OR e.valid_to >= ?))",
    ];
    const params: any[] = [timestamp, timestamp];

    if (relation_type) {
        conditions.push("e.relation_type = ?");
        params.push(relation_type);
    }

    // Tenant-scope BOTH the source fact (via JOIN to source_id) and the
    // joined target fact. Otherwise an attacker could craft an edge whose
    // target is another tenant's fact and read it through the relation.
    const sql = `
        SELECT f.*, e.relation_type, e.weight
        FROM temporal_edges e
        JOIN temporal_facts f ON e.target_id = f.id
        JOIN temporal_facts src ON e.source_id = src.id
        WHERE e.source_id = ?
        AND src.user_id = ?
        AND f.user_id = ?
        AND ${conditions.join(" AND ")}
        AND (f.valid_from <= ? AND (f.valid_to IS NULL OR f.valid_to >= ?))
        ORDER BY e.weight DESC, f.confidence DESC
    `;

    const rows = await all_async(sql, [
        fact_id,
        user_id,
        user_id,
        ...params,
        timestamp,
        timestamp,
    ]);
    return rows.map((row) => ({
        fact: {
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
        },
        relation: row.relation_type,
        weight: row.weight,
    }));
};
