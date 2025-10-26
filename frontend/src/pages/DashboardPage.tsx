import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, AreaChart, Area, XAxis, YAxis, CartesianGrid, Cell } from 'recharts'
import { Button } from '@/components/ui/button'
import { dashboardDB } from '@/lib/dashboard-db'
import type { RequestLog, ActivityLog } from '@/lib/dashboard-db'
import { useAuth } from '@/hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { useMemoryStore } from '@/stores/memory-store'

interface RequestStats {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  successRate: number
  averageDuration: number
  methodBreakdown: Record<string, number>
  statusBreakdown: Record<string, number>
}

interface RequestByDay {
  date: string
  count: number
  successful: number
  failed: number
  averageDuration: number
}

export function DashboardPage() {
  const [stats, setStats] = useState<RequestStats | null>(null)
  const [requestsByDay, setRequestsByDay] = useState<RequestByDay[]>([])
  const [recentRequests, setRecentRequests] = useState<RequestLog[]>([])
  const [recentActivities, setRecentActivities] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)

  const { user, isAuthenticated, isAuthEnabled, signOut } = useAuth()
  const navigate = useNavigate()
  const { memories, fetchMemories } = useMemoryStore()

  useEffect(() => {
    loadDashboardData()
    fetchMemories()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)

      // Load all dashboard data in parallel
      const [statsData, requestsByDayData, requestsData, activitiesData] = await Promise.all([
        dashboardDB.getRequestStats(7),
        dashboardDB.getRequestsByDay(30),
        dashboardDB.getRequestLogs(7),
        dashboardDB.getActivityLogs(7)
      ])

      setStats(statsData)
      setRequestsByDay(requestsByDayData)
      setRecentRequests(requestsData.slice(0, 10))
      setRecentActivities(activitiesData.slice(0, 10))
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading dashboard...</div>
      </div>
    )
  }

  const chartConfig = {
    count: {
      label: "Requests",
      color: "hsl(var(--chart-1))",
    },
    successful: {
      label: "Successful",
      color: "hsl(var(--chart-2))",
    },
    failed: {
      label: "Failed",
      color: "hsl(var(--chart-3))",
    },
    duration: {
      label: "Avg Duration (ms)",
      color: "hsl(var(--chart-4))",
    },
    episodic: {
      label: "Episodic",
      color: "hsl(var(--chart-1))",
    },
    semantic: {
      label: "Semantic",
      color: "hsl(var(--chart-2))",
    },
    procedural: {
      label: "Procedural",
      color: "hsl(var(--chart-3))",
    },
    emotional: {
      label: "Emotional",
      color: "hsl(var(--chart-4))",
    },
    reflective: {
      label: "Reflective",
      color: "hsl(var(--chart-5))",
    }
  }

  // Memory sector distribution
  const memorySectorData = memories.reduce((acc, memory) => {
    const sector = memory.primary_sector || 'unknown'
    acc[sector] = (acc[sector] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const sectorChartData = Object.entries(memorySectorData).map(([sector, count]) => ({
    sector,
    count,
    fill: `var(--color-${sector})`
  }))

  // Salience distribution
  const salienceRanges = [
    { range: '0.0-0.2', min: 0, max: 0.2, count: 0 },
    { range: '0.2-0.4', min: 0.2, max: 0.4, count: 0 },
    { range: '0.4-0.6', min: 0.4, max: 0.6, count: 0 },
    { range: '0.6-0.8', min: 0.6, max: 0.8, count: 0 },
    { range: '0.8-1.0', min: 0.8, max: 1.0, count: 0 }
  ]

  memories.forEach((memory) => {
    const salience = memory.salience || 0
    const range = salienceRanges.find((r) => salience >= r.min && salience < r.max) || salienceRanges[salienceRanges.length - 1]
    if (range) range.count++
  })

  // Status code breakdown
  const statusCodeData = Object.entries(stats?.statusBreakdown || {}).map(([code, count]) => ({
    code,
    count,
    fill: code.startsWith('2') ? 'hsl(var(--chart-2))' :
          code.startsWith('4') ? 'hsl(var(--chart-3))' :
          code.startsWith('5') ? 'hsl(var(--chart-1))' : 'hsl(var(--chart-4))'
  }))

  // Top endpoints by request count
  const endpointCounts = recentRequests.reduce((acc, req) => {
    acc[req.endpoint] = (acc[req.endpoint] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const topEndpointsData = Object.entries(endpointCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([endpoint, count]) => ({
      endpoint: endpoint.length > 30 ? endpoint.substring(0, 27) + '...' : endpoint,
      count
    }))

  // Hourly activity pattern
  const hourlyActivity = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }))
  recentRequests.forEach((req) => {
    const hour = new Date(req.timestamp).getHours()
    hourlyActivity[hour].count++
  })

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))']

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">OpenMemory Dashboard</h1>
        {isAuthEnabled && (
          <div className="flex gap-2">
            {isAuthenticated ? (
              <>
                <span className="text-sm text-muted-foreground self-center">
                  Welcome, {user?.name || user?.email}
                </span>
                <Button variant="outline" onClick={() => signOut()}>
                  Sign Out
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => navigate('/auth')}>
                Sign In
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Requests</CardTitle>
            <CardDescription>Last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.totalRequests || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Success Rate</CardTitle>
            <CardDescription>Last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.successRate?.toFixed(1) || 0}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Avg Duration</CardTitle>
            <CardDescription>Last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.averageDuration?.toFixed(0) || 0}ms</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Failed Requests</CardTitle>
            <CardDescription>Last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{stats?.failedRequests || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Requests by Day */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Requests Over Time</CardTitle>
            <CardDescription>Daily request count (last 30 days)</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <LineChart data={requestsByDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="var(--color-count)"
                  strokeWidth={2}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Memory Sector Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Memory Distribution</CardTitle>
            <CardDescription>Memories by sector type</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <PieChart>
                <Pie
                  data={sectorChartData}
                  dataKey="count"
                  nameKey="sector"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(entry) => `${entry.sector}: ${entry.count}`}
                >
                  {sectorChartData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Success vs Failed */}
        <Card>
          <CardHeader>
            <CardTitle>Success vs Failed</CardTitle>
            <CardDescription>Request outcomes (last 30 days)</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <BarChart data={requestsByDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="successful" fill="var(--color-successful)" />
                <Bar dataKey="failed" fill="var(--color-failed)" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Salience Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Salience Distribution</CardTitle>
            <CardDescription>Memory strength ranges</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <BarChart data={salienceRanges}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Status Code Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>HTTP Status Codes</CardTitle>
            <CardDescription>Response code distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <PieChart>
                <Pie
                  data={statusCodeData}
                  dataKey="count"
                  nameKey="code"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(entry) => `${entry.code}: ${entry.count}`}
                >
                  {statusCodeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Average Duration */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Response Time Trend</CardTitle>
            <CardDescription>Average duration per day (ms)</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <AreaChart data={requestsByDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="averageDuration"
                  stroke="var(--color-duration)"
                  fill="var(--color-duration)"
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Hourly Activity Pattern */}
        <Card>
          <CardHeader>
            <CardTitle>Activity by Hour</CardTitle>
            <CardDescription>Request patterns (24h)</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <AreaChart data={hourlyActivity}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" tickFormatter={(value) => `${value}:00`} />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="var(--color-count)"
                  fill="var(--color-count)"
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Method Breakdown */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>HTTP Methods</CardTitle>
            <CardDescription>Request distribution by method</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <BarChart data={Object.entries(stats?.methodBreakdown || {}).map(([method, count]) => ({
                method,
                count
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="method" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Top Endpoints */}
        <Card>
          <CardHeader>
            <CardTitle>Top Endpoints</CardTitle>
            <CardDescription>Most requested endpoints</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <BarChart data={topEndpointsData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="endpoint" type="category" width={100} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Requests</CardTitle>
          <CardDescription>Last 10 API requests</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Timestamp</th>
                  <th className="text-left p-2">Method</th>
                  <th className="text-left p-2">Endpoint</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Duration</th>
                </tr>
              </thead>
              <tbody>
                {recentRequests.map((req) => (
                  <tr key={req.id} className="border-b hover:bg-muted/50">
                    <td className="p-2">{new Date(req.timestamp).toLocaleString()}</td>
                    <td className="p-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        req.method === 'GET' ? 'bg-blue-100 text-blue-800' :
                        req.method === 'POST' ? 'bg-green-100 text-green-800' :
                        req.method === 'PUT' ? 'bg-yellow-100 text-yellow-800' :
                        req.method === 'DELETE' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {req.method}
                      </span>
                    </td>
                    <td className="p-2 font-mono text-xs">{req.endpoint}</td>
                    <td className="p-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        req.status >= 200 && req.status < 300 ? 'bg-green-100 text-green-800' :
                        req.status >= 400 ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="p-2">{req.duration}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activities */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activities</CardTitle>
          <CardDescription>Last 10 user activities</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <div className="font-medium">{activity.action}</div>
                  {activity.userId && (
                    <div className="text-sm text-muted-foreground">User: {activity.userId}</div>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {new Date(activity.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
