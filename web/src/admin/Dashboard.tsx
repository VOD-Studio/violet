/**
 * 后台首页 / 数据看板
 * 展示文章数、待审核评论数等统计信息
 * 包含最近文章列表和待审核评论提示
 */

import { Link } from "react-router"
import { useAdminStats } from "@/hooks/useAdmin"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

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
 * 数据看板页面
 * 调用 API 获取统计数据，展示网站运营概览
 */
export default function Dashboard() {
  const { stats, isLoading, error } = useAdminStats()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">数据看板</h1>
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">数据看板</h1>
          <p className="text-destructive">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold">数据看板</h1>
        <p className="text-muted-foreground">查看网站运营数据概览</p>
      </div>

      {/* 统计卡片网格 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              文章总数
            </CardTitle>
            <span className="text-xl">📝</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.postCount ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              评论总数
            </CardTitle>
            <span className="text-xl">💬</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.commentCount ?? 0}</div>
          </CardContent>
        </Card>

        {/* 待审核评论卡片，高亮显示 */}
        <Card className={stats?.pendingCommentCount ? "border-orange-400" : undefined}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              待审核评论
            </CardTitle>
            <span className="text-xl">⏳</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {stats?.pendingCommentCount ?? 0}
            </div>
            {stats?.pendingCommentCount ? (
              <Button variant="link" size="sm" className="mt-1 h-auto p-0 text-xs" asChild>
                <Link to="/admin/comments">前往审核</Link>
              </Button>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">暂无待审核评论</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              最近文章
            </CardTitle>
            <span className="text-xl">📄</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.recentPosts.length ?? 0}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">近期发布</p>
          </CardContent>
        </Card>
      </div>

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
              {stats?.recentPosts.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-24 text-center text-muted-foreground"
                  >
                    暂无文章数据
                  </TableCell>
                </TableRow>
              ) : (
                stats?.recentPosts.map((post) => (
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
