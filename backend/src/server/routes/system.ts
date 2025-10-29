import { allAsync } from '../../database'
import { SECTOR_CONFIGS } from '../../hsg'
import { getEmbeddingInfo } from '../../embedding'

export function sys(app: any) {
    app.get('/health', async (incoming_http_request: any, outgoing_http_response: any) => {
        outgoing_http_response.json({
            ok: true,
            version: '2.0-hsg',
            embedding: getEmbeddingInfo()
        })
    })

    app.get('/sectors', async (incoming_http_request: any, outgoing_http_response: any) => {
        try {
            const database_sector_statistics_rows = await allAsync(`
                select primary_sector as sector, count(*) as count, avg(salience) as avg_salience 
                from memories 
                group by primary_sector
            `)
            outgoing_http_response.json({
                sectors: Object.keys(SECTOR_CONFIGS),
                configs: SECTOR_CONFIGS,
                stats: database_sector_statistics_rows
            })
        } catch (unexpected_error_fetching_sectors) {
            outgoing_http_response.status(500).json({ err: 'internal' })
        }
    })
}
