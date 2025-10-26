import { useEffect, useState, useCallback, lazy, Suspense } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Brain, Database, Search, TrendingUp, Activity, Clock, Zap, AlertCircle, RefreshCw } from 'lucide-react'
import { useMemoryStore } from '@/stores/memory-store'
import { useAnalyticsStore } from '@/stores/analytics-store'
import { openMemoryClient } from '@/lib/api-client'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageTransition, StaggerContainer, StaggerItem } from '@/components/animations/page-transitions'
import { useConnectionStatus } from '@/hooks/use-connection-status'

// Lazy load chart components to reduce initial bundle size
const SectorDistributionChart = lazy(() => import('@/components/charts/overview-charts').then(m => ({ default: m.SectorDistributionChart })))
const SalienceDistributionChart = lazy(() => import('@/components/charts/overview-charts').then(m => ({ default: m.SalienceDistributionChart })))
const MemoryTrendChart = lazy(() => import('@/components/charts/overview-charts').then(m => ({ default: m.MemoryTrendChart })))
const SectorSalienceChart = lazy(() => import('@/components/charts/overview-charts').then(m => ({ default: m.SectorSalienceChart })))

interface HealthData {
  version: string
  embedding: {
    provider: string
    dimensions: number
    model?: string
  }
}

interface SectorStat {
  sector: string
  count: number
  avg_salience?: number | null
}

interface SectorsData {
  sectors: string[]
  stats?: SectorStat[]
}

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))']
const REFRESH_INTERVAL = parseInt(import.meta.env.VITE_AUTO_REFRESH_INTERVAL || '5000')

export function OverviewPage() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [sectors, setSectors] = useState<SectorsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [autoRefresh, setAutoRefresh] = useState(true)

  const memories = useMemoryStore((state) => state.memories)
  const apiCalls = useAnalyticsStore((state) => state.apiCalls)
  const fetchMemories = useMemoryStore((state) => state.fetchMemories)

  const { isConnected } = useConnectionStatus()

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [healthData, sectorsData] = await Promise.all([
        openMemoryClient.health(),
        openMemoryClient.getSectors(),
      ])

      setHealth(healthData)
      setSectors(sectorsData)
      await fetchMemories()
      setLastUpdate(new Date())
    } catch (err) {
      console.error('Failed to load overview:', err)
    } finally {
      setLoading(false)
    }
  }, [fetchMemories])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Auto-refresh functionality - only when connected and auto-refresh is enabled
  useEffect(() => {
    if (!autoRefresh || !isConnected) return

    const interval = setInterval(() => {
      loadData()
    }, REFRESH_INTERVAL)

    return () => clearInterval(interval)
  }, [autoRefresh, isConnected, loadData])

  // Chart configurations
  const chartConfig = {
    count: { label: "Count", color: "hsl(var(--chart-1))" },
    salience: { label: "Salience", color: "hsl(var(--chart-2))" },
    episodic: { label: "Episodic", color: "hsl(var(--chart-1))" },
    semantic: { label: "Semantic", color: "hsl(var(--chart-2))" },
    procedural: { label: "Procedural", color: "hsl(var(--chart-3))" },
    emotional: { label: "Emotional", color: "hsl(var(--chart-4))" },
    reflective: { label: "Reflective", color: "hsl(var(--chart-5))" },
  }

  // Process memory data for charts
  const sectorDistribution = sectors?.stats?.map((stat) => ({
    sector: stat.sector,
    count: stat.count,
    fill: `var(--color-${stat.sector})`
  })) || []

  const salienceDistribution = [
    { range: '0.0-0.2', min: 0, max: 0.2, count: 0 },
    { range: '0.2-0.4', min: 0.2, max: 0.4, count: 0 },
    { range: '0.4-0.6', min: 0.4, max: 0.6, count: 0 },
    { range: '0.6-0.8', min: 0.6, max: 0.8, count: 0 },
    { range: '0.8-1.0', min: 0.8, max: 1.0, count: 0 }
  ]

  memories.forEach((memory) => {
    const salience = memory.salience || 0
    const range = salienceDistribution.find((r) => salience >= r.min && salience < r.max) || salienceDistribution[4]
    if (range) range.count++
  })

  // Recent memories trend (last 7 days)
  const memoryTrend = (() => {
    const days = 7
    const now = Date.now()
    const dayInMs = 24 * 60 * 60 * 1000
    const trend = []

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now - i * dayInMs)
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const count = memories.filter(m => {
        const memDate = new Date(m.created_at)
        return memDate.toDateString() === date.toDateString()
      }).length
      trend.push({ date: dateStr, count })
    }
    return trend
  })()

  // Top memories by salience
  const topMemories = [...memories]
    .sort((a, b) => (b.salience || 0) - (a.salience || 0))
    .slice(0, 5)

  // Average salience per sector
  const sectorSalienceAvg = sectors?.stats?.map((stat) => ({
    sector: stat.sector,
    avgSalience: stat.avg_salience || 0
  })) || []

  if (loading && memories.length === 0) {
    return (
      <div className="space-y-6">
        <div className="w-full grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-[100px]" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-[60px]" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  const stats = [
    {
      title: 'Total Memories',
      value: memories.length.toLocaleString(),
      description: 'Stored memories across all sectors',
      icon: Database,
      trend: memoryTrend.length > 1 ? `+${memoryTrend[memoryTrend.length - 1].count} today` : null
    },
    {
      title: 'Active Sectors',
      value: sectors?.sectors?.length || 0,
      description: 'Memory classification sectors',
      icon: Brain,
      trend: `${sectorDistribution.length} with data`
    },
    {
      title: 'API Calls',
      value: apiCalls.length.toLocaleString(),
      description: 'Total API requests made',
      icon: Search,
      trend: `${apiCalls.filter(c => Date.now() - c.timestamp < 3600000).length} last hour`
    },
    {
      title: 'Avg Salience',
      value: memories.length > 0
        ? (memories.reduce((sum, m) => sum + (m.salience || 0), 0) / memories.length).toFixed(3)
        : '0.000',
      description: 'Overall memory strength',
      icon: TrendingUp,
      trend: 'Real-time'
    }
  ]

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Dashboard Overview</h2>
            <p className="text-muted-foreground">
              Monitor your OpenMemory system status and statistics
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              {lastUpdate.toLocaleTimeString()}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadData()}
              disabled={loading}
            >
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Activity className="h-4 w-4 mr-1" />
            {autoRefresh ? 'Auto' : 'Manual'}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <StaggerContainer className="w-full grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StaggerItem key={stat.title}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">
                  {stat.description}
                </p>
                {stat.trend && (
                  <Badge variant="secondary" className="mt-2 text-xs">
                    {stat.trend}
                  </Badge>
                )}
              </CardContent>
            </Card>
          </StaggerItem>
        ))}
      </StaggerContainer>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Sector Distribution Pie Chart */}
        {sectorDistribution.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Sector Distribution</CardTitle>
              <CardDescription>Memory count by sector type</CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<Skeleton className="h-[250px] w-full" />}>
                <SectorDistributionChart
                  data={sectorDistribution}
                  colors={COLORS}
                  chartConfig={chartConfig}
                />
              </Suspense>
            </CardContent>
          </Card>
        )}

        {/* Salience Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Salience Distribution</CardTitle>
            <CardDescription>Memory strength ranges</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<Skeleton className="h-[250px] w-full" />}>
              <SalienceDistributionChart
                data={salienceDistribution}
                chartConfig={chartConfig}
              />
            </Suspense>
          </CardContent>
        </Card>

        {/* Memory Growth Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Memory Growth</CardTitle>
            <CardDescription>New memories (last 7 days)</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<Skeleton className="h-[250px] w-full" />}>
              <MemoryTrendChart
                data={memoryTrend}
                chartConfig={chartConfig}
              />
            </Suspense>
          </CardContent>
        </Card>

        {/* Average Salience by Sector */}
        {sectorSalienceAvg.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Average Salience by Sector</CardTitle>
              <CardDescription>Memory strength comparison across sectors</CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<Skeleton className="h-[250px] w-full" />}>
                <SectorSalienceChart
                  data={sectorSalienceAvg}
                  chartConfig={chartConfig}
                />
              </Suspense>
            </CardContent>
          </Card>
        )}

        {/* Top Memories */}
        <Card>
          <CardHeader>
            <CardTitle>Top Memories</CardTitle>
            <CardDescription>Highest salience memories</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topMemories.length > 0 ? (
                topMemories.map((memory, index) => (
                  <div key={memory.id} className="flex items-start gap-3 p-2 rounded-lg border">
                    <Badge variant="outline" className="shrink-0">#{index + 1}</Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {memory.content.substring(0, 50)}...
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {memory.primary_sector}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {memory.salience.toFixed(3)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-sm text-muted-foreground py-4">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  No memories yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sector Statistics Table */}
        {sectors?.stats && sectors.stats.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Sector Statistics</CardTitle>
              <CardDescription>Detailed sector breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sectors.stats.map((stat) => (
                  <div key={stat.sector} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium capitalize">{stat.sector}</div>
                        <Badge variant="outline" className="text-xs">
                          {stat.count} memories
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Avg Salience: {stat.avg_salience?.toFixed(3) || 'N/A'}
                      </div>
                    </div>
                    <div className="text-xl font-bold">{stat.count}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* System Health */}
        {health && (
          <Card>
            <CardHeader>
              <CardTitle>System Health</CardTitle>
              <CardDescription>Current system status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-2 rounded-lg bg-green-50 dark:bg-green-950/20">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Status</span>
                </div>
                <Badge className="bg-green-600">● Online</Badge>
              </div>
              <div className="flex justify-between p-2 border-b">
                <span className="text-sm font-medium">Version:</span>
                <span className="text-sm">{health.version}</span>
              </div>
              <div className="flex justify-between p-2 border-b">
                <span className="text-sm font-medium">Embedding Provider:</span>
                <Badge variant="secondary" className="capitalize">{health.embedding.provider}</Badge>
              </div>
              {health.embedding.model && (
                <div className="flex justify-between p-2 border-b">
                  <span className="text-sm font-medium">Model:</span>
                  <span className="text-sm font-mono">{health.embedding.model}</span>
                </div>
              )}
              <div className="flex justify-between p-2">
                <span className="text-sm font-medium">Vector Dimensions:</span>
                <Badge variant="outline">{health.embedding.dimensions}</Badge>
              </div>
              <div className="flex justify-between p-2 bg-muted/50 rounded-lg">
                <span className="text-sm font-medium">Auto-refresh:</span>
                <Badge variant={autoRefresh ? "default" : "secondary"}>
                  {autoRefresh ? `Every ${REFRESH_INTERVAL / 1000}s` : 'Disabled'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
    </PageTransition>
  )
}
