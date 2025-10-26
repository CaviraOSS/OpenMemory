import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from '@hono/node-server/serve-static'
import { PrismaClient } from '@prisma/client'
import { auth } from './auth'

const app = new Hono()

// Initialize Prisma Client pointing to frontend/prisma/dashboard.db
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./prisma/dashboard.db'
    }
  }
})

// CORS configuration
app.use('/*', cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}))

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ===== AUTHENTICATION API (OPTIONAL - BETTER-AUTH) =====
// Mount better-auth routes at /api/auth/*
app.on(['POST', 'GET'], '/api/auth/*', (c) => {
  return auth.handler(c.req.raw)
})

// ===== REQUEST LOGS API =====
app.post('/api/logs/request', async (c) => {
  try {
    const body = await c.req.json()
    const log = await prisma.requestLog.create({
      data: {
        timestamp: new Date(body.timestamp),
        method: body.method,
        endpoint: body.endpoint,
        status: body.status,
        duration: body.duration,
        requestBody: body.requestBody,
        responseBody: body.responseBody
      }
    })
    return c.json(log)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: message }, 500)
  }
})

app.get('/api/logs/requests', async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7')
    const since = new Date()
    since.setDate(since.getDate() - days)

    const logs = await prisma.requestLog.findMany({
      where: {
        timestamp: {
          gte: since
        }
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: 1000
    })
    return c.json(logs)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: message }, 500)
  }
})

// ===== ACTIVITY LOGS API =====
app.post('/api/logs/activity', async (c) => {
  try {
    const body = await c.req.json()
    const log = await prisma.activityLog.create({
      data: {
        userId: body.userId,
        action: body.action,
        metadata: body.metadata ? JSON.stringify(body.metadata) : null,
        timestamp: body.timestamp ? new Date(body.timestamp) : new Date()
      }
    })
    return c.json(log)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: message }, 500)
  }
})

app.get('/api/logs/activities', async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7')
    const userId = c.req.query('userId')
    const since = new Date()
    since.setDate(since.getDate() - days)

    const logs = await prisma.activityLog.findMany({
      where: {
        timestamp: {
          gte: since
        },
        ...(userId ? { userId } : {})
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: 1000
    })
    return c.json(logs)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: message }, 500)
  }
})

// ===== METRICS API =====
app.post('/api/metrics', async (c) => {
  try {
    const body = await c.req.json()
    const metric = await prisma.dashboardMetric.create({
      data: {
        metricName: body.metricName,
        value: body.value,
        timestamp: body.timestamp ? new Date(body.timestamp) : new Date()
      }
    })
    return c.json(metric)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: message }, 500)
  }
})

app.get('/api/metrics', async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7')
    const metricName = c.req.query('metricName')
    const since = new Date()
    since.setDate(since.getDate() - days)

    const metrics = await prisma.dashboardMetric.findMany({
      where: {
        timestamp: {
          gte: since
        },
        ...(metricName ? { metricName } : {})
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: 1000
    })
    return c.json(metrics)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: message }, 500)
  }
})

// ===== ANALYTICS API =====
app.get('/api/stats/requests', async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7')
    const since = new Date()
    since.setDate(since.getDate() - days)

    const logs = await prisma.requestLog.findMany({
      where: {
        timestamp: {
          gte: since
        }
      }
    })

    const totalRequests = logs.length
    const successfulRequests = logs.filter(log => log.status >= 200 && log.status < 300).length
    const failedRequests = logs.filter(log => log.status >= 400).length
    const averageDuration = logs.length > 0
      ? logs.reduce((sum, log) => sum + log.duration, 0) / logs.length
      : 0

    const methodBreakdown = logs.reduce((acc: Record<string, number>, log) => {
      acc[log.method] = (acc[log.method] || 0) + 1
      return acc
    }, {})

    const statusBreakdown = logs.reduce((acc: Record<string, number>, log) => {
      const statusRange = `${Math.floor(log.status / 100)}xx`
      acc[statusRange] = (acc[statusRange] || 0) + 1
      return acc
    }, {})

    return c.json({
      totalRequests,
      successfulRequests,
      failedRequests,
      successRate: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0,
      averageDuration,
      methodBreakdown,
      statusBreakdown
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: message }, 500)
  }
})

app.get('/api/stats/requests-by-day', async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '30')
    const since = new Date()
    since.setDate(since.getDate() - days)

    const logs = await prisma.requestLog.findMany({
      where: {
        timestamp: {
          gte: since
        }
      }
    })

    interface DayStats {
      date: string
      count: number
      successful: number
      failed: number
      totalDuration: number
    }

    const byDay = logs.reduce((acc: Record<string, DayStats>, log) => {
      const day = log.timestamp.toISOString().split('T')[0]
      if (!acc[day]) {
        acc[day] = { date: day, count: 0, successful: 0, failed: 0, totalDuration: 0 }
      }
      acc[day].count++
      if (log.status >= 200 && log.status < 300) acc[day].successful++
      if (log.status >= 400) acc[day].failed++
      acc[day].totalDuration += log.duration
      return acc
    }, {})

    const result = Object.values(byDay).map((day) => ({
      ...day,
      averageDuration: day.count > 0 ? day.totalDuration / day.count : 0
    }))

    return c.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: message }, 500)
  }
})

// ===== DATABASE MANAGEMENT =====
app.get('/api/db/export', async (c) => {
  try {
    const [requestLogs, activityLogs, metrics] = await Promise.all([
      prisma.requestLog.findMany(),
      prisma.activityLog.findMany(),
      prisma.dashboardMetric.findMany()
    ])

    return c.json({
      requestLogs,
      activityLogs,
      metrics,
      exportedAt: new Date().toISOString()
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: message }, 500)
  }
})

app.post('/api/db/import', async (c) => {
  try {
    const body = await c.req.json()

    // Clear existing data
    await Promise.all([
      prisma.requestLog.deleteMany(),
      prisma.activityLog.deleteMany(),
      prisma.dashboardMetric.deleteMany()
    ])

    // Import new data
    if (body.requestLogs?.length) {
      await prisma.requestLog.createMany({ data: body.requestLogs })
    }
    if (body.activityLogs?.length) {
      await prisma.activityLog.createMany({ data: body.activityLogs })
    }
    if (body.metrics?.length) {
      await prisma.dashboardMetric.createMany({ data: body.metrics })
    }

    return c.json({ success: true, message: 'Data imported successfully' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: message }, 500)
  }
})

app.delete('/api/db/clear', async (c) => {
  try {
    await Promise.all([
      prisma.requestLog.deleteMany(),
      prisma.activityLog.deleteMany(),
      prisma.dashboardMetric.deleteMany()
    ])

    return c.json({ success: true, message: 'All data cleared' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: message }, 500)
  }
})

// ===== SERVE STATIC FILES (Frontend Build) =====
// Serve static assets from dist folder (when built)
app.use('/assets/*', serveStatic({ root: './dist' }))
app.use('/favicon.ico', serveStatic({ path: './dist/favicon.ico' }))

// SPA fallback - serve index.html for all other routes
app.get('*', serveStatic({ path: './dist/index.html' }))

export default app
