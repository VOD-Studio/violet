/**
 * 后台数据看板页面
 * 展示统计卡片、浏览量趋势图、热门文章排行、最近文章列表
 */

import { Link } from "react-router"
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
import { useAdminStats, useViewTrends } from "@/hooks/useAdmin"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorFallback } from "@/components/shared/ErrorFallback"

/**
 * 将 ISO 日期字符串格式化为简短的本地日期
 * @param isoString - ISO 格式的日期字符串
 * @returns 格式化后的日期，如 "2026/4/28"
 */
function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return "—"
  return new Date(isoString).toLocaleDateString("zh-CN")
}

/**
 * 格式化日期标签，截取月/日部分
 * @param dateStr - 日期字符串，格式 YYYY-MM-DD
 * @returns 短日期，如 "4/28"
 */
function formatDayLabel(dateStr: string): string {
  const parts = dateStr.split("-")
  return `${Number.parseInt(parts[1])}/${Number.parseInt(parts[2])}`
}

/**
 * 格式化月份标签
 * @param monthStr - 月份字符串，格式 YYYY-MM
 * @returns 短月份，如 "2026/4"
 */
function formatMonthLabel(monthStr: string): string {
  const parts = monthStr.split("-")
  return `${parts[0]}/${Number.parseInt(parts[1])}`
}

/**
 * 统计卡片加载态骨架屏
 */
function StatsCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="size-5" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16" />
      </CardContent>
    </Card>
  )
}

/** 图表加载态骨架屏 */
function ChartSkeleton() {
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

/** 统计卡片图标映射 */
function StatIcon({ type }: { type: string }) {
  const iconMap: Record<string, React.ReactNode> = {
    posts: (
      <svg className="size-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
    comments: (
      <svg className="size-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.22 48.22 0 005.253-.443c1.584-.236 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
      </svg>
    ),
    pending: (
      <svg className="size-5 text-orange-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    views: (
      <svg className="size-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    users: (
      <svg className="size-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  }
  return <>{iconMap[type] ?? null}</>
}

/**
 * 数据看板页面
 * 组合统计卡片、折线图、柱状图、排行榜和文章列表
 */
export default function Dashboard() {
  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useAdminStats()
  const { data: viewTrends, isLoading: viewsLoading } = useViewTrends()

  /* 统计数据加载中 */
  if (statsLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">数据看板</h1>
          <p className="text-muted-foreground">加载中...</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <StatsCardSkeleton key={i} />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      </div>
    )
  }

  /* 统计数据加载失败 */
  if (statsError) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">数据看板</h1>
        <ErrorFallback error={statsError.message} onRetry={refetchStats} />
      </div>
    )
  }

  /* 处理每日浏览量数据 */
  const dailyData =
    viewTrends?.daily.map((item) => ({
      date: formatDayLabel(item.date),
      views: item.count,
    })) ?? []

  /* 处理月度浏览量数据 */
  const monthlyData =
    viewTrends?.monthly.map((item) => ({
      month: formatMonthLabel(item.month),
      views: item.count,
    })) ?? []

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold">数据看板</h1>
        <p className="text-muted-foreground">查看网站运营数据概览</p>
      </div>

      {/* 统计卡片区域 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">文章总数</CardTitle>
            <StatIcon type="posts" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalPosts.toLocaleString() ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">评论总数</CardTitle>
            <StatIcon type="comments" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalComments.toLocaleString() ?? 0}</div>
          </CardContent>
        </Card>

        <Card className={stats?.pendingComments ? "border-orange-400" : undefined}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">待审核评论</CardTitle>
            <StatIcon type="pending" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats?.pendingComments ?? 0}</div>
            {stats?.pendingComments ? (
              <Link to="/admin/comments" className="mt-1 inline-block text-xs text-primary underline-offset-4 hover:underline">
                前往审核
              </Link>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">暂无待审核评论</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">总浏览量</CardTitle>
            <StatIcon type="views" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalViews.toLocaleString() ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">用户总数</CardTitle>
            <StatIcon type="users" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalUsers.toLocaleString() ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* 浏览量趋势图表区域 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 每日浏览量折线图 */}
        <Card>
          <CardHeader>
            <CardTitle>浏览量趋势</CardTitle>
            <CardDescription>最近 30 天每日浏览量变化</CardDescription>
          </CardHeader>
          <CardContent>
            {viewsLoading ? (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                图表加载中...
              </div>
            ) : dailyData.length === 0 ? (
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
            {viewsLoading ? (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                图表加载中...
              </div>
            ) : monthlyData.length === 0 ? (
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

      {/* 热门文章排行 */}
      <Card>
        <CardHeader>
          <CardTitle>热门文章</CardTitle>
          <CardDescription>浏览量最高的文章排行</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">排名</TableHead>
                <TableHead>标题</TableHead>
                <TableHead className="text-right">浏览量</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!stats?.popularPosts || stats.popularPosts.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="h-24 text-center text-muted-foreground"
                  >
                    暂无热门文章数据
                  </TableCell>
                </TableRow>
              ) : (
                stats.popularPosts.map((post, index) => (
                  <TableRow key={post.id}>
                    <TableCell>
                      <Badge
                        variant={index < 3 ? "default" : "secondary"}
                        className="w-7 justify-center"
                      >
                        {index + 1}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link
                        to={`/admin/posts/${post.id}/edit`}
                        className="hover:underline"
                      >
                        {post.title}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">
                      {post.views.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 最近文章列表 */}
      <Card>
        <CardHeader>
          <CardTitle>最近文章</CardTitle>
          <CardDescription>最新的博客文章动态</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>标题</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">浏览量</TableHead>
                <TableHead>发布时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!stats?.recentPosts || stats.recentPosts.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-24 text-center text-muted-foreground"
                  >
                    暂无文章数据
                  </TableCell>
                </TableRow>
              ) : (
                stats.recentPosts.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell className="font-medium">{post.title}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          post.status === "published" ? "default" : "secondary"
                        }
                      >
                        {post.status === "published" ? "已发布" : "草稿"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {post.views.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(post.publishedAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
