

import { get_async, all_async } from '../core/db'
import { TemporalFact, TemporalQuery, TimelineEntry } from './types'


export const query_facts_at_time = async (
    subject?: string,
    predicate?: string,
    object?: string,
    at: Date = new Date(),
    min_confidence: number = 0.1
): Promise<TemporalFact[]> => {
    const timestamp = at.getTime()
    const conditions: string[] = []
    const params: any[] = []


    conditions.push('(valid_from <= ? AND (valid_to IS NULL OR valid_to >= ?))')
    params.push(timestamp, timestamp)

    if (subject) {
        conditions.push('subject = ?')
        params.push(subject)
    }

    if (predicate) {
        conditions.push('predicate = ?')
        params.push(predicate)
    }

    if (object) {
        conditions.push('object = ?')
        params.push(object)
    }

    if (min_confidence > 0) {
        conditions.push('confidence >= ?')
        params.push(min_confidence)
    }

    const sql = `
        SELECT id, subject, predicate, object, valid_from, valid_to, confidence, last_updated, metadata
        FROM temporal_facts
        WHERE ${conditions.join(' AND ')}
        ORDER BY confidence DESC, valid_from DESC
    `

    const rows = await all_async(sql, params)
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
    }))
}


export const get_current_fact = async (
    subject: string,
    predicate: string
): Promise<TemporalFact | null> => {
    const now = Date.now()

    const row = await get_async(`
        SELECT id, subject, predicate, object, valid_from, valid_to, confidence, last_updated, metadata
        FROM temporal_facts
        WHERE subject = ? AND predicate = ? AND valid_to IS NULL
        ORDER BY valid_from DESC
        LIMIT 1
    `, [subject, predicate])

    if (!row) return null

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
    }
}


export const query_facts_in_range = async (
    subject?: string,
    predicate?: string,
    from?: Date,
    to?: Date,
    min_confidence: number = 0.1
): Promise<TemporalFact[]> => {
    const conditions: string[] = []
    const params: any[] = []

    if (from && to) {
        const from_ts = from.getTime()
        const to_ts = to.getTime()
        conditions.push('((valid_from <= ? AND (valid_to IS NULL OR valid_to >= ?)) OR (valid_from >= ? AND valid_from <= ?))')
        params.push(to_ts, from_ts, from_ts, to_ts)
    } else if (from) {
        conditions.push('valid_from >= ?')
        params.push(from.getTime())
    } else if (to) {
        conditions.push('valid_from <= ?')
        params.push(to.getTime())
    }

    if (subject) {
        conditions.push('subject = ?')
        params.push(subject)
    }

    if (predicate) {
        conditions.push('predicate = ?')
        params.push(predicate)
    }

    if (min_confidence > 0) {
        conditions.push('confidence >= ?')
        params.push(min_confidence)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const sql = `
        SELECT id, subject, predicate, object, valid_from, valid_to, confidence, last_updated, metadata
        FROM temporal_facts
        ${where}
        ORDER BY valid_from DESC
    `

    const rows = await all_async(sql, params)
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
    }))
}


export const find_conflicting_facts = async (
    subject: string,
    predicate: string,
    at?: Date
): Promise<TemporalFact[]> => {
    const timestamp = at ? at.getTime() : Date.now()

    const rows = await all_async(`
        SELECT id, subject, predicate, object, valid_from, valid_to, confidence, last_updated, metadata
        FROM temporal_facts
        WHERE subject = ? AND predicate = ?
        AND (valid_from <= ? AND (valid_to IS NULL OR valid_to >= ?))
        ORDER BY confidence DESC
    `, [subject, predicate, timestamp, timestamp])

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
    }))
}


export const get_facts_by_subject = async (
    subject: string,
    at?: Date,
    include_historical: boolean = false
): Promise<TemporalFact[]> => {
    let sql: string
    let params: any[]

    if (include_historical) {
        sql = `
            SELECT id, subject, predicate, object, valid_from, valid_to, confidence, last_updated, metadata
            FROM temporal_facts
            WHERE subject = ?
            ORDER BY predicate ASC, valid_from DESC
        `
        params = [subject]
    } else {
        const timestamp = at ? at.getTime() : Date.now()
        sql = `
            SELECT id, subject, predicate, object, valid_from, valid_to, confidence, last_updated, metadata
            FROM temporal_facts
            WHERE subject = ?
            AND (valid_from <= ? AND (valid_to IS NULL OR valid_to >= ?))
            ORDER BY predicate ASC, confidence DESC
        `
        params = [subject, timestamp, timestamp]
    }

    const rows = await all_async(sql, params)
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
    }))
}


export const search_facts = async (
    pattern: string,
    field: 'subject' | 'predicate' | 'object' = 'subject',
    at?: Date
): Promise<TemporalFact[]> => {
    const timestamp = at ? at.getTime() : Date.now()
    const search_pattern = `%${pattern}%`

    const sql = `
        SELECT id, subject, predicate, object, valid_from, valid_to, confidence, last_updated, metadata
        FROM temporal_facts
        WHERE ${field} LIKE ?
        AND (valid_from <= ? AND (valid_to IS NULL OR valid_to >= ?))
        ORDER BY confidence DESC, valid_from DESC
        LIMIT 100
    `

    const rows = await all_async(sql, [search_pattern, timestamp, timestamp])
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
    }))
}


export const get_related_facts = async (
    fact_id: string,
    relation_type?: string,
    at?: Date
): Promise<Array<{ fact: TemporalFact; relation: string; weight: number }>> => {
    const timestamp = at ? at.getTime() : Date.now()
    const conditions = ['(e.valid_from <= ? AND (e.valid_to IS NULL OR e.valid_to >= ?))']
    const params: any[] = [timestamp, timestamp]

    if (relation_type) {
        conditions.push('e.relation_type = ?')
        params.push(relation_type)
    }

    const sql = `
        SELECT f.*, e.relation_type, e.weight
        FROM temporal_edges e
        JOIN temporal_facts f ON e.target_id = f.id
        WHERE e.source_id = ?
        AND ${conditions.join(' AND ')}
        AND (f.valid_from <= ? AND (f.valid_to IS NULL OR f.valid_to >= ?))
        ORDER BY e.weight DESC, f.confidence DESC
    `

    const rows = await all_async(sql, [fact_id, ...params, timestamp, timestamp])
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
    }))
}
