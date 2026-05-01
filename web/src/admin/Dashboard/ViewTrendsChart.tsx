// ViewTrendsChart.tsx
// 浏览量趋势图表组件

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface DailyView {
  date: string
  count: number
}

interface MonthlyView {
  month: string
  count: number
}

interface ViewTrendsChartProps {
  daily: DailyView[]
  monthly: MonthlyView[]
  isLoading: boolean
}

function formatDayLabel(dateStr: string): string {
  const parts = dateStr.split("-")
  return `${Number.parseInt(parts[1])}/${Number.parseInt(parts[2])}`
}

function formatMonthLabel(monthStr: string): string {
  const parts = monthStr.split("-")
  return `${parts[0]}/${Number.parseInt(parts[1])}`
}

export function ViewTrendsChart({ daily, monthly, isLoading }: ViewTrendsChartProps) {
  const dailyData = daily.map((item) => ({
    date: formatDayLabel(item.date),
    views: item.count,
  }))

  const monthlyData = monthly.map((item) => ({
    month: formatMonthLabel(item.month),
    views: item.count,
  }))

  if (isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* 每日浏览量折线图 */}
      <Card>
        <CardHeader>
          <CardTitle>浏览量趋势</CardTitle>
          <CardDescription>最近 30 天每日浏览量变化</CardDescription>
        </CardHeader>
        <CardContent>
          {dailyData.length === 0 ? (
            <div className="flex h-[300px] items-center justify-center text-muted-foreground">
              暂无浏览量数据
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  tickLine={false}
                  axisLine={false}
                  width={50}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid hsl(var(--border))",
                    backgroundColor: "hsl(var(--card))",
                    fontSize: "13px",
                  }}
                  labelFormatter={(label) => `日期: ${label}`}
                  formatter={(value) => [Number(value).toLocaleString(), "浏览量"]}
                />
                <Line
                  type="monotone"
                  dataKey="views"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "hsl(var(--primary))" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* 月度浏览量柱状图 */}
      <Card>
        <CardHeader>
          <CardTitle>月度浏览量</CardTitle>
          <CardDescription>最近 12 个月浏览量统计</CardDescription>
        </CardHeader>
        <CardContent>
          {monthlyData.length === 0 ? (
            <div className="flex h-[300px] items-center justify-center text-muted-foreground">
              暂无月度数据
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  tickLine={false}
                  axisLine={false}
                  width={50}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid hsl(var(--border))",
                    backgroundColor: "hsl(var(--card))",
                    fontSize: "13px",
                  }}
                  labelFormatter={(label) => `月份: ${label}`}
                  formatter={(value) => [Number(value).toLocaleString(), "浏览量"]}
                />
                <Bar
                  dataKey="views"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function ChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-48" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[300px]" />
      </CardContent>
    </Card>
  )
}