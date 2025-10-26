import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { PieChart, Pie, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Cell } from 'recharts'

interface ChartData {
  [key: string]: string | number
}

interface SectorDistributionChartProps {
  data: ChartData[]
  colors: string[]
  chartConfig: Record<string, { label: string; color: string }>
}

export function SectorDistributionChart({ data, colors, chartConfig }: SectorDistributionChartProps) {
  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent />} />
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={(entry) => entry.sector}
          outerRadius={80}
          fill="#8884d8"
          dataKey="count"
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  )
}

interface SalienceDistributionChartProps {
  data: ChartData[]
  chartConfig: Record<string, { label: string; color: string }>
}

export function SalienceDistributionChart({ data, chartConfig }: SalienceDistributionChartProps) {
  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="range" />
        <YAxis />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="count" fill="hsl(var(--chart-1))" />
      </BarChart>
    </ChartContainer>
  )
}

interface MemoryTrendChartProps {
  data: ChartData[]
  chartConfig: Record<string, { label: string; color: string }>
}

export function MemoryTrendChart({ data, chartConfig }: MemoryTrendChartProps) {
  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area
          type="monotone"
          dataKey="count"
          stroke="hsl(var(--chart-1))"
          fill="hsl(var(--chart-1))"
          fillOpacity={0.6}
        />
      </AreaChart>
    </ChartContainer>
  )
}

interface SectorSalienceChartProps {
  data: ChartData[]
  chartConfig: Record<string, { label: string; color: string }>
}

export function SectorSalienceChart({ data, chartConfig }: SectorSalienceChartProps) {
  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="sector" />
        <YAxis />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="avgSalience" fill="hsl(var(--chart-2))" />
      </BarChart>
    </ChartContainer>
  )
}
