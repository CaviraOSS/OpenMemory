import { run_async, get_async, all_async } from '../core/db'
import { TemporalFact, TemporalEdge } from './types'
import { randomUUID } from 'crypto'

export const insert_fact = async (
    subject: string,
    predicate: string,
    object: string,
    valid_from: Date = new Date(),
    confidence: number = 1.0,
    metadata?: Record<string, any>
): Promise<string> => {
    const id = randomUUID()
    const now = Date.now()
    const valid_from_ts = valid_from.getTime()

    const existing = await all_async(`
        SELECT id, valid_from FROM temporal_facts
        WHERE subject = ? AND predicate = ? AND valid_to IS NULL
        ORDER BY valid_from DESC
    `, [subject, predicate])

    for (const old of existing) {
        if (old.valid_from < valid_from_ts) {
            await run_async(`UPDATE temporal_facts SET valid_to = ? WHERE id = ?`, [valid_from_ts - 1, old.id])
            console.error(`[TEMPORAL] Closed fact ${old.id} at ${new Date(valid_from_ts - 1).toISOString()}`)
        }
    }

    await run_async(`
        INSERT INTO temporal_facts (id, subject, predicate, object, valid_from, valid_to, confidence, last_updated, metadata)
        VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)
    `, [id, subject, predicate, object, valid_from_ts, confidence, now, metadata ? JSON.stringify(metadata) : null])

    console.error(`[TEMPORAL] Inserted fact: ${subject} ${predicate} ${object} (from ${valid_from.toISOString()}, confidence=${confidence})`)
    return id
}

export const update_fact = async (id: string, confidence?: number, metadata?: Record<string, any>): Promise<void> => {
    const updates: string[] = []
    const params: any[] = []

    if (confidence !== undefined) {
        updates.push('confidence = ?')
        params.push(confidence)
    }

    if (metadata !== undefined) {
        updates.push('metadata = ?')
        params.push(JSON.stringify(metadata))
    }

    updates.push('last_updated = ?')
    params.push(Date.now())

    params.push(id)

    if (updates.length > 0) {
        await run_async(`UPDATE temporal_facts SET ${updates.join(', ')} WHERE id = ?`, params)
        console.error(`[TEMPORAL] Updated fact ${id}`)
    }
}

export const invalidate_fact = async (id: string, valid_to: Date = new Date()): Promise<void> => {
    await run_async(`UPDATE temporal_facts SET valid_to = ?, last_updated = ? WHERE id = ?`, [valid_to.getTime(), Date.now(), id])
    console.error(`[TEMPORAL] Invalidated fact ${id} at ${valid_to.toISOString()}`)
}

export const delete_fact = async (id: string): Promise<void> => {
    await run_async(`DELETE FROM temporal_facts WHERE id = ?`, [id])
    console.error(`[TEMPORAL] Deleted fact ${id}`)
}

export const insert_edge = async (
    source_id: string,
    target_id: string,
    relation_type: string,
    valid_from: Date = new Date(),
    weight: number = 1.0,
    metadata?: Record<string, any>
): Promise<string> => {
    const id = randomUUID()
    const valid_from_ts = valid_from.getTime()

    await run_async(`
        INSERT INTO temporal_edges (id, source_id, target_id, relation_type, valid_from, valid_to, weight, metadata)
        VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
    `, [id, source_id, target_id, relation_type, valid_from_ts, weight, metadata ? JSON.stringify(metadata) : null])

    console.log(`[TEMPORAL] Created edge: ${source_id} --[${relation_type}]--> ${target_id}`)
    return id
}

export const invalidate_edge = async (id: string, valid_to: Date = new Date()): Promise<void> => {
    await run_async(`UPDATE temporal_edges SET valid_to = ? WHERE id = ?`, [valid_to.getTime(), id])
    console.log(`[TEMPORAL] Invalidated edge ${id}`)
}

export const batch_insert_facts = async (facts: Array<{
    subject: string
    predicate: string
    object: string
    valid_from?: Date
    confidence?: number
    metadata?: Record<string, any>
}>): Promise<string[]> => {
    const ids: string[] = []

    await run_async('BEGIN TRANSACTION')
    try {
        for (const fact of facts) {
            const id = await insert_fact(
                fact.subject,
                fact.predicate,
                fact.object,
                fact.valid_from,
                fact.confidence,
                fact.metadata
            )
            ids.push(id)
        }
        await run_async('COMMIT')
        console.log(`[TEMPORAL] Batch inserted ${ids.length} facts`)
    } catch (error) {
        await run_async('ROLLBACK')
        throw error
    }

    return ids
}

export const apply_confidence_decay = async (decay_rate: number = 0.01): Promise<number> => {
    const now = Date.now()
    const one_day = 86400000

    await run_async(`
        UPDATE temporal_facts
        SET confidence = MAX(0.1, confidence * (1 - ? * ((? - valid_from) / ?)))
        WHERE valid_to IS NULL AND confidence > 0.1
    `, [decay_rate, now, one_day])

    const result = await get_async(`SELECT changes() as changes`) as any
    const changes = result?.changes || 0
    console.log(`[TEMPORAL] Applied confidence decay to ${changes} facts`)
    return changes
}

export const get_active_facts_count = async (): Promise<number> => {
    const result = await get_async(`SELECT COUNT(*) as count FROM temporal_facts WHERE valid_to IS NULL`) as any
    return result?.count || 0
}

export const get_total_facts_count = async (): Promise<number> => {
    const result = await get_async(`SELECT COUNT(*) as count FROM temporal_facts`) as any
    return result?.count || 0
}