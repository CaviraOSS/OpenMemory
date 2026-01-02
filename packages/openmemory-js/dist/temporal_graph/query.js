"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.get_related_facts = exports.search_facts = exports.get_facts_by_subject = exports.find_conflicting_facts = exports.query_facts_in_range = exports.get_current_fact = exports.query_facts_at_time = void 0;
const db_1 = require("../core/db");
const query_facts_at_time = async (subject, predicate, object, at = new Date(), min_confidence = 0.1) => {
    const timestamp = at.getTime();
    const conditions = [];
    const params = [];
    // Build WHERE clause
    conditions.push('(valid_from <= ? AND (valid_to IS NULL OR valid_to >= ?))');
    params.push(timestamp, timestamp);
    if (subject) {
        conditions.push('subject = ?');
        params.push(subject);
    }
    if (predicate) {
        conditions.push('predicate = ?');
        params.push(predicate);
    }
    if (object) {
        conditions.push('object = ?');
        params.push(object);
    }
    if (min_confidence > 0) {
        conditions.push('confidence >= ?');
        params.push(min_confidence);
    }
    const sql = `
        SELECT id, subject, predicate, object, valid_from, valid_to, confidence, last_updated, metadata
        FROM temporal_facts
        WHERE ${conditions.join(' AND ')}
        ORDER BY confidence DESC, valid_from DESC
    `;
    const rows = await (0, db_1.all_async)(sql, params);
    return rows.map(row => ({
        id: row.id,
        subject: row.subject,
        predicate: row.predicate,
        object: row.object,
        valid_from: new Date(row.valid_from),
        valid_to: row.valid_to ? new Date(row.valid_to) : null,
        confidence: row.confidence,
        last_updated: new Date(row.last_updated),
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }));
};
exports.query_facts_at_time = query_facts_at_time;
const get_current_fact = async (subject, predicate) => {
    const now = Date.now();
    const row = await (0, db_1.get_async)(`
        SELECT id, subject, predicate, object, valid_from, valid_to, confidence, last_updated, metadata
        FROM temporal_facts
        WHERE subject = ? AND predicate = ? AND valid_to IS NULL
        ORDER BY valid_from DESC
        LIMIT 1
    `, [subject, predicate]);
    if (!row)
        return null;
    return {
        id: row.id,
        subject: row.subject,
        predicate: row.predicate,
        object: row.object,
        valid_from: new Date(row.valid_from),
        valid_to: row.valid_to ? new Date(row.valid_to) : null,
        confidence: row.confidence,
        last_updated: new Date(row.last_updated),
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    };
};
exports.get_current_fact = get_current_fact;
const query_facts_in_range = async (subject, predicate, from, to, min_confidence = 0.1) => {
    const conditions = [];
    const params = [];
    if (from && to) {
        const from_ts = from.getTime();
        const to_ts = to.getTime();
        conditions.push('((valid_from <= ? AND (valid_to IS NULL OR valid_to >= ?)) OR (valid_from >= ? AND valid_from <= ?))');
        params.push(to_ts, from_ts, from_ts, to_ts);
    }
    else if (from) {
        conditions.push('valid_from >= ?');
        params.push(from.getTime());
    }
    else if (to) {
        conditions.push('valid_from <= ?');
        params.push(to.getTime());
    }
    if (subject) {
        conditions.push('subject = ?');
        params.push(subject);
    }
    if (predicate) {
        conditions.push('predicate = ?');
        params.push(predicate);
    }
    if (min_confidence > 0) {
        conditions.push('confidence >= ?');
        params.push(min_confidence);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
        SELECT id, subject, predicate, object, valid_from, valid_to, confidence, last_updated, metadata
        FROM temporal_facts
        ${where}
        ORDER BY valid_from DESC
    `;
    const rows = await (0, db_1.all_async)(sql, params);
    return rows.map(row => ({
        id: row.id,
        subject: row.subject,
        predicate: row.predicate,
        object: row.object,
        valid_from: new Date(row.valid_from),
        valid_to: row.valid_to ? new Date(row.valid_to) : null,
        confidence: row.confidence,
        last_updated: new Date(row.last_updated),
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }));
};
exports.query_facts_in_range = query_facts_in_range;
const find_conflicting_facts = async (subject, predicate, at) => {
    const timestamp = at ? at.getTime() : Date.now();
    const rows = await (0, db_1.all_async)(`
        SELECT id, subject, predicate, object, valid_from, valid_to, confidence, last_updated, metadata
        FROM temporal_facts
        WHERE subject = ? AND predicate = ?
        AND (valid_from <= ? AND (valid_to IS NULL OR valid_to >= ?))
        ORDER BY confidence DESC
    `, [subject, predicate, timestamp, timestamp]);
    return rows.map(row => ({
        id: row.id,
        subject: row.subject,
        predicate: row.predicate,
        object: row.object,
        valid_from: new Date(row.valid_from),
        valid_to: row.valid_to ? new Date(row.valid_to) : null,
        confidence: row.confidence,
        last_updated: new Date(row.last_updated),
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }));
};
exports.find_conflicting_facts = find_conflicting_facts;
const get_facts_by_subject = async (subject, at, include_historical = false) => {
    let sql;
    let params;
    if (include_historical) {
        sql = `
            SELECT id, subject, predicate, object, valid_from, valid_to, confidence, last_updated, metadata
            FROM temporal_facts
            WHERE subject = ?
            ORDER BY predicate ASC, valid_from DESC
        `;
        params = [subject];
    }
    else {
        const timestamp = at ? at.getTime() : Date.now();
        sql = `
            SELECT id, subject, predicate, object, valid_from, valid_to, confidence, last_updated, metadata
            FROM temporal_facts
            WHERE subject = ?
            AND (valid_from <= ? AND (valid_to IS NULL OR valid_to >= ?))
            ORDER BY predicate ASC, confidence DESC
        `;
        params = [subject, timestamp, timestamp];
    }
    const rows = await (0, db_1.all_async)(sql, params);
    return rows.map(row => ({
        id: row.id,
        subject: row.subject,
        predicate: row.predicate,
        object: row.object,
        valid_from: new Date(row.valid_from),
        valid_to: row.valid_to ? new Date(row.valid_to) : null,
        confidence: row.confidence,
        last_updated: new Date(row.last_updated),
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }));
};
exports.get_facts_by_subject = get_facts_by_subject;
const search_facts = async (pattern, field = 'subject', at) => {
    const timestamp = at ? at.getTime() : Date.now();
    const search_pattern = `%${pattern}%`;
    const sql = `
        SELECT id, subject, predicate, object, valid_from, valid_to, confidence, last_updated, metadata
        FROM temporal_facts
        WHERE ${field} LIKE ?
        AND (valid_from <= ? AND (valid_to IS NULL OR valid_to >= ?))
        ORDER BY confidence DESC, valid_from DESC
        LIMIT 100
    `;
    const rows = await (0, db_1.all_async)(sql, [search_pattern, timestamp, timestamp]);
    return rows.map(row => ({
        id: row.id,
        subject: row.subject,
        predicate: row.predicate,
        object: row.object,
        valid_from: new Date(row.valid_from),
        valid_to: row.valid_to ? new Date(row.valid_to) : null,
        confidence: row.confidence,
        last_updated: new Date(row.last_updated),
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }));
};
exports.search_facts = search_facts;
const get_related_facts = async (fact_id, relation_type, at) => {
    const timestamp = at ? at.getTime() : Date.now();
    const conditions = ['(e.valid_from <= ? AND (e.valid_to IS NULL OR e.valid_to >= ?))'];
    const params = [timestamp, timestamp];
    if (relation_type) {
        conditions.push('e.relation_type = ?');
        params.push(relation_type);
    }
    const sql = `
        SELECT f.*, e.relation_type, e.weight
        FROM temporal_edges e
        JOIN temporal_facts f ON e.target_id = f.id
        WHERE e.source_id = ?
        AND ${conditions.join(' AND ')}
        AND (f.valid_from <= ? AND (f.valid_to IS NULL OR f.valid_to >= ?))
        ORDER BY e.weight DESC, f.confidence DESC
    `;
    const rows = await (0, db_1.all_async)(sql, [fact_id, ...params, timestamp, timestamp]);
    return rows.map(row => ({
        fact: {
            id: row.id,
            subject: row.subject,
            predicate: row.predicate,
            object: row.object,
            valid_from: new Date(row.valid_from),
            valid_to: row.valid_to ? new Date(row.valid_to) : null,
            confidence: row.confidence,
            last_updated: new Date(row.last_updated),
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined
        },
        relation: row.relation_type,
        weight: row.weight
    }));
};
exports.get_related_facts = get_related_facts;
