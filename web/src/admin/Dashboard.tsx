/**
 * 后台首页 / 数据看板
 * 展示文章数、评论数、浏览量、用户数等统计信息
 * 包含最近评论列表和热门文章列表
 */

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

/** 统计卡片数据项 */
interface StatItem {
  /** 指标名称 */
  title: string
  /** 指标数值 */
  value: string
  /** 变化描述 */
  change: string
  /** 图标标识 */
  icon: string
}

/** 统计卡片示例数据 */
const statItems: StatItem[] = [
  { title: "文章总数", value: "128", change: "+12 本月", icon: "📝" },
  { title: "评论总数", value: "1,024", change: "+56 本周", icon: "💬" },
  { title: "总浏览量", value: "45.2K", change: "+2.1K 本月", icon: "👁️" },
  { title: "注册用户", value: "356", change: "+23 本月", icon: "👥" },
]

/** 最近评论数据项 */
interface RecentComment {
  /** 评论 ID */
  id: number
  /** 评论作者 */
  author: string
  /** 评论内容摘要 */
  content: string
  /** 评论所属文章 */
  postTitle: string
  /** 评论时间 */
  time: string
}

/** 最近评论示例数据 */
const recentComments: RecentComment[] = [
  {
    id: 1,
    author: "张三",
    content: "这篇文章写得非常详细，受益匪浅！",
    postTitle: "React 19 新特性解析",
    time: "10 分钟前",
  },
  {
    id: 2,
    author: "李四",
    content: "请问 TypeScript 6 的泛型推断有什么改进？",
    postTitle: "TypeScript 6 升级指南",
    time: "30 分钟前",
  },
  {
    id: 3,
    author: "王五",
    content: "Tailwind v4 的配置方式变化很大，需要更新一下",
    postTitle: "Tailwind CSS v4 迁移笔记",
    time: "1 小时前",
  },
  {
    id: 4,
    author: "赵六",
    content: "实际测试中发现了几个兼容性问题",
    postTitle: "Vite 8 构建优化实践",
    time: "2 小时前",
  },
  {
    id: 5,
    author: "孙七",
    content: "感谢分享，已经成功部署到生产环境",
    postTitle: "Docker 容器化部署教程",
    time: "3 小时前",
  },
]

/** 热门文章数据项 */
interface PopularPost {
  /** 文章 ID */
  id: number
  /** 文章标题 */
  title: string
  /** 浏览量 */
  views: number
  /** 评论数 */
  comments: number
  /** 文章状态 */
  status: "已发布" | "草稿"
}

/** 热门文章示例数据 */
const popularPosts: PopularPost[] = [
  { id: 1, title: "React 19 新特性解析", views: 12500, comments: 89, status: "已发布" },
  { id: 2, title: "TypeScript 6 升级指南", views: 9800, comments: 56, status: "已发布" },
  { id: 3, title: "Tailwind CSS v4 迁移笔记", views: 8200, comments: 42, status: "已发布" },
  { id: 4, title: "Vite 8 构建优化实践", views: 6500, comments: 38, status: "已发布" },
  { id: 5, title: "Next.js vs Remix 深度对比", views: 5200, comments: 31, status: "草稿" },
]

/**
 * 数据看板页面
 * 展示网站核心指标、最近评论和热门文章
 */
export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold">数据看板</h1>
        <p className="text-muted-foreground">查看网站运营数据概览</p>
      </div>

      {/* 统计卡片网格 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statItems.map((item) => (
          <Card key={item.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {item.title}
              </CardTitle>
              <span className="text-xl">{item.icon}</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{item.value}</div>
              <p className="mt-1 text-xs text-muted-foreground">{item.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 下方两栏布局：最近评论 + 热门文章 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 最近评论卡片 */}
        <Card>
          <CardHeader>
            <CardTitle>最近评论</CardTitle>
            <CardDescription>最新的用户评论动态</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>作者</TableHead>
                  <TableHead>内容</TableHead>
                  <TableHead>文章</TableHead>
                  <TableHead>时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentComments.map((comment) => (
                  <TableRow key={comment.id}>
                    <TableCell className="font-medium">{comment.author}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {comment.content}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {comment.postTitle}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {comment.time}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* 热门文章卡片 */}
        <Card>
          <CardHeader>
            <CardTitle>热门文章</CardTitle>
            <CardDescription>浏览量最高的文章排行</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>标题</TableHead>
                  <TableHead className="text-right">浏览量</TableHead>
                  <TableHead className="text-right">评论</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {popularPosts.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell className="font-medium">{post.title}</TableCell>
                    <TableCell className="text-right">
                      {post.views.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">{post.comments}</TableCell>
                    <TableCell>
                      <Badge
                        variant={post.status === "已发布" ? "default" : "secondary"}
                      >
                        {post.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
