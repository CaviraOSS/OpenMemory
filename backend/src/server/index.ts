const server = require('./server.js')
import { env, tier } from '../core/cfg'
import { run_decay_process, prune_weak_waypoints } from '../memory/hsg'
import { mcp } from '../ai/mcp'
import { routes } from './routes'
import { authenticate_api_request, log_authenticated_request } from './middleware/auth'
import { start_reflection } from '../memory/reflect'
import { start_user_summary_reflection } from '../memory/user_summary'

const app = server({ max_payload_size: env.max_payload_size })

console.log(`[OpenMemory] Dim: ${env.vec_dim} | Cache: ${env.cache_segments} segments | Max Active: ${env.max_active}`)

app.use((req: any, res: any, next: any) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-api-key')
    if (req.method === 'OPTIONS') {
        res.status(200).end()
        return
    }
    next()
})

app.use(authenticate_api_request)

if (process.env.OM_LOG_AUTH === 'true') {
    app.use(log_authenticated_request)
}

routes(app)

mcp(app)
if (env.mode === 'langgraph') {
    console.log('[LGM] LangGraph integration mode enabled')
}
// Decay interval: Configurable via OM_DECAY_INTERVAL_MINUTES (default 24h = 1440 min)
// Set OM_DECAY_INTERVAL_MINUTES=0.5 for testing (30 seconds)
const decayIntervalMs = env.decay_interval_minutes * 60 * 1000
console.log(`⏱️  Decay interval: ${env.decay_interval_minutes} minutes (${decayIntervalMs / 1000}s)`)

setInterval(async () => {
    console.log('🧠 Running HSG decay process...')
    try {
        const result = await run_decay_process()
        console.log(`✅ Decay completed: ${result.decayed}/${result.processed} memories updated`)
    } catch (error) {
        console.error('❌ Decay process failed:', error)
    }
}, decayIntervalMs)
setInterval(async () => {
    console.log('🔗 Pruning weak waypoints...')
    try {
        const pruned = await prune_weak_waypoints()
        console.log(`✅ Pruned ${pruned} weak waypoints`)
    } catch (error) {
        console.error('❌ Waypoint pruning failed:', error)
    }
}, 7 * 24 * 60 * 60 * 1000)
run_decay_process().then((result: any) => {
    console.log(`🚀 Initial decay: ${result.decayed}/${result.processed} memories updated`)
}).catch(console.error)

start_reflection()
start_user_summary_reflection()

console.log(`?? OpenMemory server starting on port ${env.port}`)
app.listen(env.port, () => {
    console.log(`? Server running on http://localhost:${env.port}`)
})
