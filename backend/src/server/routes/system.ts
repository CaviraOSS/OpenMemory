import { allAsync } from '../../database'
import { SECTOR_CONFIGS } from '../../hsg'
import { getEmbeddingInfo } from '../../embedding'
import { tier, env } from '../../config'

const TIER_BENEFITS = {
    fast: { recall: 70, qps: '700-850', ram: '0.6GB/10k', use: 'Local apps, extensions' },
    smart: { recall: 85, qps: '500-600', ram: '0.9GB/10k', use: 'Production servers' },
    deep: { recall: 94, qps: '350-400', ram: '1.6GB/10k', use: 'Cloud, high-accuracy' }
}

export function sys(app: any) {
    app.get('/health', async (incoming_http_request: any, outgoing_http_response: any) => {
        outgoing_http_response.json({
            ok: true,
            version: '2.0-hsg-tiered',
            embedding: getEmbeddingInfo(),
            tier,
            dim: env.vec_dim,
            cache: env.cache_segments,
            expected: TIER_BENEFITS[tier]
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