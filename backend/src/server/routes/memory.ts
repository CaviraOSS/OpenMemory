import { q } from '../../database'
import { now, rid, j, p } from '../../utils'
import {
    addHSGMemory,
    hsgQuery,
    reinforceMemory,
    updateMemory,
    SECTORS,
    SECTOR_CONFIGS
} from '../../hsg'
import { ingestDocument, ingestURL } from '../../ingestion'
import type {
    add_req,
    q_req,
    ingest_req,
    ingest_url_req
} from '../../types'

export function mem(app: any) {
    app.post('/memory/add', async (incoming_http_request: any, outgoing_http_response: any) => {
        const incoming_request_body_data = incoming_http_request.body as add_req
        if (!incoming_request_body_data?.content) return outgoing_http_response.status(400).json({ err: 'content' })
        try {
            const memory_creation_result_object = await addHSGMemory(incoming_request_body_data.content, j(incoming_request_body_data.tags || []), incoming_request_body_data.metadata)
            outgoing_http_response.json(memory_creation_result_object)
        } catch (unexpected_error_during_memory_addition) {
            console.error('Error adding HSG memory:', unexpected_error_during_memory_addition)
            outgoing_http_response.status(500).json({ err: 'internal' })
        }
    })

    app.post('/memory/ingest', async (incoming_http_request: any, outgoing_http_response: any) => {
        const incoming_request_body_data = incoming_http_request.body as ingest_req
        if (!incoming_request_body_data?.content_type || !incoming_request_body_data?.data) {
            return outgoing_http_response.status(400).json({ err: 'missing_params' })
        }
        try {
            const document_ingestion_result_object = await ingestDocument(
                incoming_request_body_data.content_type,
                incoming_request_body_data.data,
                incoming_request_body_data.metadata,
                incoming_request_body_data.config
            )
            outgoing_http_response.json(document_ingestion_result_object)
        } catch (unexpected_error_during_document_ingestion) {
            console.error('Error ingesting document:', unexpected_error_during_document_ingestion)
            outgoing_http_response.status(500).json({
                err: 'ingestion_failed',
                message: unexpected_error_during_document_ingestion instanceof Error ? unexpected_error_during_document_ingestion.message : 'Unknown error'
            })
        }
    })

    app.post('/memory/ingest/url', async (incoming_http_request: any, outgoing_http_response: any) => {
        const incoming_request_body_data = incoming_http_request.body as ingest_url_req
        if (!incoming_request_body_data?.url) {
            return outgoing_http_response.status(400).json({ err: 'missing_url' })
        }
        try {
            const url_ingestion_result_object = await ingestURL(incoming_request_body_data.url, incoming_request_body_data.metadata, incoming_request_body_data.config)
            outgoing_http_response.json(url_ingestion_result_object)
        } catch (unexpected_error_during_url_ingestion) {
            console.error('Error ingesting URL:', unexpected_error_during_url_ingestion)
            outgoing_http_response.status(500).json({
                err: 'url_ingestion_failed',
                message: unexpected_error_during_url_ingestion instanceof Error ? unexpected_error_during_url_ingestion.message : 'Unknown error'
            })
        }
    })

    app.post('/memory/query', async (incoming_http_request: any, outgoing_http_response: any) => {
        const incoming_request_body_data = incoming_http_request.body as q_req
        const number_of_results_to_return = incoming_request_body_data.k || 8
        try {
            const query_filters_configuration_object = {
                sectors: incoming_request_body_data.filters?.sector ? [incoming_request_body_data.filters.sector] : undefined,
                minSalience: incoming_request_body_data.filters?.min_score
            }
            const matching_memories_result_array = await hsgQuery(incoming_request_body_data.query, number_of_results_to_return, query_filters_configuration_object)
            outgoing_http_response.json({
                query: incoming_request_body_data.query,
                matches: matching_memories_result_array.map(memory_match_item => ({
                    id: memory_match_item.id,
                    content: memory_match_item.content,
                    score: memory_match_item.score,
                    sectors: memory_match_item.sectors,
                    primary_sector: memory_match_item.primary_sector,
                    path: memory_match_item.path,
                    salience: memory_match_item.salience,
                    last_seen_at: memory_match_item.last_seen_at
                }))
            })
        } catch (unexpected_error_during_hsg_query) {
            console.error('Error in HSG query:', unexpected_error_during_hsg_query)
            outgoing_http_response.json({ query: incoming_request_body_data.query, matches: [] })
        }
    })

    app.post('/memory/reinforce', async (incoming_http_request: any, outgoing_http_response: any) => {
        const incoming_request_body_data = incoming_http_request.body as { id: string, boost?: number }
        if (!incoming_request_body_data?.id) return outgoing_http_response.status(400).json({ err: 'id' })
        try {
            await reinforceMemory(incoming_request_body_data.id, incoming_request_body_data.boost)
            outgoing_http_response.json({ ok: true })
        } catch (unexpected_error_during_reinforcement) {
            outgoing_http_response.status(404).json({ err: 'nf' })
        }
    })

    app.patch('/memory/:id', async (incoming_http_request: any, outgoing_http_response: any) => {
        const memory_identifier_from_url_params = (incoming_http_request.params as any).id
        const incoming_request_body_data = incoming_http_request.body as { content?: string, tags?: string[], metadata?: any }
        if (!memory_identifier_from_url_params) return outgoing_http_response.status(400).json({ err: 'id' })
        try {
            const memory_update_result_object = await updateMemory(memory_identifier_from_url_params, incoming_request_body_data.content, incoming_request_body_data.tags, incoming_request_body_data.metadata)
            outgoing_http_response.json(memory_update_result_object)
        } catch (unexpected_error_during_memory_update) {
            if (unexpected_error_during_memory_update instanceof Error && unexpected_error_during_memory_update.message.includes('not found')) {
                outgoing_http_response.status(404).json({ err: 'nf' })
            } else {
                console.error('Error updating memory:', unexpected_error_during_memory_update)
                outgoing_http_response.status(500).json({ err: 'internal' })
            }
        }
    })

    app.get('/memory/all', async (incoming_http_request: any, outgoing_http_response: any) => {
        try {
            const pagination_offset_value = (incoming_http_request.query as any).u ? parseInt((incoming_http_request.query as any).u) : 0
            const pagination_limit_value = (incoming_http_request.query as any).l ? parseInt((incoming_http_request.query as any).l) : 100
            const sector_filter_value = (incoming_http_request.query as any).sector
            const raw_memory_rows_from_database = sector_filter_value
                ? await q.all_mem_by_sector.all(sector_filter_value, pagination_limit_value, pagination_offset_value)
                : await q.all_mem.all(pagination_limit_value, pagination_offset_value)
            const transformed_memory_rows_array = raw_memory_rows_from_database.map((database_row_record: any) => ({
                id: database_row_record.id,
                content: database_row_record.content,
                tags: p(database_row_record.tags),
                metadata: p(database_row_record.meta),
                created_at: database_row_record.created_at,
                updated_at: database_row_record.updated_at,
                last_seen_at: database_row_record.last_seen_at,
                salience: database_row_record.salience,
                decay_lambda: database_row_record.decay_lambda,
                primary_sector: database_row_record.primary_sector,
                version: database_row_record.version
            }))
            outgoing_http_response.json({ items: transformed_memory_rows_array })
        } catch (unexpected_error_fetching_all_memories) {
            outgoing_http_response.status(500).json({ err: 'internal' })
        }
    })

    app.get('/memory/:id', async (incoming_http_request: any, outgoing_http_response: any) => {
        try {
            const memory_identifier_from_url_params = (incoming_http_request.params as any).id
            const memory_record_from_database = await q.get_mem.get(memory_identifier_from_url_params)
            if (!memory_record_from_database) return outgoing_http_response.status(404).json({ err: 'nf' })

            const vector_embeddings_for_memory = await q.get_vecs_by_id.all(memory_identifier_from_url_params)
            const sectors_array_from_vectors = vector_embeddings_for_memory.map(vector_record => vector_record.sector)

            outgoing_http_response.json({
                id: memory_record_from_database.id,
                content: memory_record_from_database.content,
                primary_sector: memory_record_from_database.primary_sector,
                sectors: sectors_array_from_vectors,
                tags: p(memory_record_from_database.tags),
                metadata: p(memory_record_from_database.meta),
                created_at: memory_record_from_database.created_at,
                updated_at: memory_record_from_database.updated_at,
                last_seen_at: memory_record_from_database.last_seen_at,
                salience: memory_record_from_database.salience,
                decay_lambda: memory_record_from_database.decay_lambda,
                version: memory_record_from_database.version
            })
        } catch (unexpected_error_fetching_single_memory) {
            outgoing_http_response.status(500).json({ err: 'internal' })
        }
    })

    app.delete('/memory/:id', async (incoming_http_request: any, outgoing_http_response: any) => {
        try {
            const memory_identifier_from_url_params = (incoming_http_request.params as any).id
            const memory_record_from_database = await q.get_mem.get(memory_identifier_from_url_params)
            if (!memory_record_from_database) return outgoing_http_response.status(404).json({ err: 'nf' })
            await q.del_mem.run(memory_identifier_from_url_params)
            await q.del_vec.run(memory_identifier_from_url_params)
            await q.del_fts.run(memory_identifier_from_url_params)
            await q.del_waypoints.run(memory_identifier_from_url_params, memory_identifier_from_url_params)
            outgoing_http_response.json({ ok: true })
        } catch (unexpected_error_deleting_memory) {
            outgoing_http_response.status(500).json({ err: 'internal' })
        }
    })
}
