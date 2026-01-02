"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.get_total_facts_count = exports.get_active_facts_count = exports.apply_confidence_decay = exports.batch_insert_facts = exports.invalidate_edge = exports.insert_edge = exports.delete_fact = exports.invalidate_fact = exports.update_fact = exports.insert_fact = void 0;
const db_1 = require("../core/db");
const crypto_1 = require("crypto");
const insert_fact = async (subject, predicate, object, valid_from = new Date(), confidence = 1.0, metadata) => {
    const id = (0, crypto_1.randomUUID)();
    const now = Date.now();
    const valid_from_ts = valid_from.getTime();
    const existing = await (0, db_1.all_async)(`
        SELECT id, valid_from FROM temporal_facts 
        WHERE subject = ? AND predicate = ? AND valid_to IS NULL
        ORDER BY valid_from DESC
    `, [subject, predicate]);
    for (const old of existing) {
        if (old.valid_from < valid_from_ts) {
            await (0, db_1.run_async)(`UPDATE temporal_facts SET valid_to = ? WHERE id = ?`, [valid_from_ts - 1, old.id]);
            console.error(`[TEMPORAL] Closed fact ${old.id} at ${new Date(valid_from_ts - 1).toISOString()}`); // Use stderr for MCP compatibility
        }
    }
    await (0, db_1.run_async)(`
        INSERT INTO temporal_facts (id, subject, predicate, object, valid_from, valid_to, confidence, last_updated, metadata)
        VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)
    `, [id, subject, predicate, object, valid_from_ts, confidence, now, metadata ? JSON.stringify(metadata) : null]);
    console.error(`[TEMPORAL] Inserted fact: ${subject} ${predicate} ${object} (from ${valid_from.toISOString()}, confidence=${confidence})`); // Use stderr for MCP compatibility
    return id;
};
exports.insert_fact = insert_fact;
const update_fact = async (id, confidence, metadata) => {
    const updates = [];
    const params = [];
    if (confidence !== undefined) {
        updates.push('confidence = ?');
        params.push(confidence);
    }
    if (metadata !== undefined) {
        updates.push('metadata = ?');
        params.push(JSON.stringify(metadata));
    }
    updates.push('last_updated = ?');
    params.push(Date.now());
    params.push(id);
    if (updates.length > 0) {
        await (0, db_1.run_async)(`UPDATE temporal_facts SET ${updates.join(', ')} WHERE id = ?`, params);
        console.error(`[TEMPORAL] Updated fact ${id}`); // Use stderr for MCP compatibility
    }
};
exports.update_fact = update_fact;
const invalidate_fact = async (id, valid_to = new Date()) => {
    await (0, db_1.run_async)(`UPDATE temporal_facts SET valid_to = ?, last_updated = ? WHERE id = ?`, [valid_to.getTime(), Date.now(), id]);
    console.error(`[TEMPORAL] Invalidated fact ${id} at ${valid_to.toISOString()}`); // Use stderr for MCP compatibility
};
exports.invalidate_fact = invalidate_fact;
const delete_fact = async (id) => {
    await (0, db_1.run_async)(`DELETE FROM temporal_facts WHERE id = ?`, [id]);
    console.error(`[TEMPORAL] Deleted fact ${id}`); // Use stderr for MCP compatibility
};
exports.delete_fact = delete_fact;
const insert_edge = async (source_id, target_id, relation_type, valid_from = new Date(), weight = 1.0, metadata) => {
    const id = (0, crypto_1.randomUUID)();
    const valid_from_ts = valid_from.getTime();
    await (0, db_1.run_async)(`
        INSERT INTO temporal_edges (id, source_id, target_id, relation_type, valid_from, valid_to, weight, metadata)
        VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
    `, [id, source_id, target_id, relation_type, valid_from_ts, weight, metadata ? JSON.stringify(metadata) : null]);
    console.log(`[TEMPORAL] Created edge: ${source_id} --[${relation_type}]--> ${target_id}`);
    return id;
};
exports.insert_edge = insert_edge;
const invalidate_edge = async (id, valid_to = new Date()) => {
    await (0, db_1.run_async)(`UPDATE temporal_edges SET valid_to = ? WHERE id = ?`, [valid_to.getTime(), id]);
    console.log(`[TEMPORAL] Invalidated edge ${id}`);
};
exports.invalidate_edge = invalidate_edge;
const batch_insert_facts = async (facts) => {
    const ids = [];
    await (0, db_1.run_async)('BEGIN TRANSACTION');
    try {
        for (const fact of facts) {
            const id = await (0, exports.insert_fact)(fact.subject, fact.predicate, fact.object, fact.valid_from, fact.confidence, fact.metadata);
            ids.push(id);
        }
        await (0, db_1.run_async)('COMMIT');
        console.log(`[TEMPORAL] Batch inserted ${ids.length} facts`);
    }
    catch (error) {
        await (0, db_1.run_async)('ROLLBACK');
        throw error;
    }
    return ids;
};
exports.batch_insert_facts = batch_insert_facts;
const apply_confidence_decay = async (decay_rate = 0.01) => {
    const now = Date.now();
    const one_day = 86400000;
    await (0, db_1.run_async)(`
        UPDATE temporal_facts 
        SET confidence = MAX(0.1, confidence * (1 - ? * ((? - valid_from) / ?)))
        WHERE valid_to IS NULL AND confidence > 0.1
    `, [decay_rate, now, one_day]);
    const result = await (0, db_1.get_async)(`SELECT changes() as changes`);
    const changes = result?.changes || 0;
    console.log(`[TEMPORAL] Applied confidence decay to ${changes} facts`);
    return changes;
};
exports.apply_confidence_decay = apply_confidence_decay;
const get_active_facts_count = async () => {
    const result = await (0, db_1.get_async)(`SELECT COUNT(*) as count FROM temporal_facts WHERE valid_to IS NULL`);
    return result?.count || 0;
};
exports.get_active_facts_count = get_active_facts_count;
const get_total_facts_count = async () => {
    const result = await (0, db_1.get_async)(`SELECT COUNT(*) as count FROM temporal_facts`);
    return result?.count || 0;
};
exports.get_total_facts_count = get_total_facts_count;
