import { allAsync, runAsync } from '../database'
import { now } from '../utils'
import { env } from '../config'
import {
    calculateDualPhaseDecayMemoryRetention,
    LAMBDA_ONE_FAST_DECAY_RATE,
    LAMBDA_TWO_SLOW_DECAY_RATE,
    THETA_CONSOLIDATION_COEFFICIENT_FOR_LONG_TERM
} from '../memory-dynamics'

export const apply_decay = async () => {
    console.log('[Decay] Starting decay job...')
    const all_memory_records_from_database = await allAsync('select id,salience,decay_lambda,last_seen_at,updated_at from memories')
    console.log(`[Decay] Fetched ${all_memory_records_from_database.length} memories`)

    const current_timestamp_in_milliseconds = now()
    const individual_memory_salience_updates = all_memory_records_from_database.map(async (memory_database_row: any) => {
        const time_difference_since_last_seen = Math.max(0, (current_timestamp_in_milliseconds - (memory_database_row.last_seen_at || memory_database_row.updated_at)) / 86400000)
        const sector_specific_lambda_decay = memory_database_row.decay_lambda || env.decay_lambda

        const fast_decay_component = Math.exp(-LAMBDA_ONE_FAST_DECAY_RATE * time_difference_since_last_seen)
        const slow_decay_component = THETA_CONSOLIDATION_COEFFICIENT_FOR_LONG_TERM * Math.exp(-LAMBDA_TWO_SLOW_DECAY_RATE * time_difference_since_last_seen)
        const combined_dual_phase_retention = fast_decay_component + slow_decay_component

        const original_sector_decay = Math.exp(-sector_specific_lambda_decay * time_difference_since_last_seen)

        const blended_decay_value = (combined_dual_phase_retention * 0.7) + (original_sector_decay * 0.3)

        const final_updated_salience = Math.max(0, memory_database_row.salience * blended_decay_value)
        return { id: memory_database_row.id, salience: final_updated_salience, old: memory_database_row.salience }
    })

    const updates = await Promise.all(individual_memory_salience_updates)
    const changed = updates.filter(u => Math.abs(u.salience - u.old) > 0.001).length

    await Promise.all(updates.map(update_operation =>
        runAsync('update memories set salience=?, updated_at=? where id=?', [update_operation.salience, current_timestamp_in_milliseconds, update_operation.id])
    ))

    console.log(`[Decay] Applied dual-phase decay to ${all_memory_records_from_database.length} memories (${changed} changed)`)
}
