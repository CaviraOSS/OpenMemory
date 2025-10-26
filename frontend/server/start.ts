import { serve } from '@hono/node-server'
import app from './index'

const port = parseInt(process.env.DASHBOARD_PORT || '3001')

console.log(`🚀 Dashboard Server starting...`)
console.log(`📊 Frontend: http://localhost:${port}`)
console.log(`🔌 API: http://localhost:${port}/api`)
console.log(`💾 Database: ./prisma/dashboard.db`)

serve({
  fetch: app.fetch,
  port
}, (info) => {
  console.log(`✅ Server listening on http://localhost:${info.port}`)
})
