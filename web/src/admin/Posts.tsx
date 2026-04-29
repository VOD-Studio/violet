/**
 * 文章管理页面
 * 展示文章列表，支持状态筛选和增删改操作
 */

import { useState } from "react"
import { Link } from "react-router"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/** 文章状态类型 */
type PostStatus = "全部" | "已发布" | "草稿"

/** 文章数据项 */
interface Post {
  /** 文章 ID */
  id: number
  /** 文章标题 */
  title: string
  /** 发布状态 */
  status: "已发布" | "草稿"
  /** 浏览量 */
  views: number
  /** 发布时间 */
  publishedAt: string
}

/** 文章示例数据 */
const mockPosts: Post[] = [
  { id: 1, title: "React 19 新特性解析", status: "已发布", views: 12500, publishedAt: "2026-04-28" },
  { id: 2, title: "TypeScript 6 升级指南", status: "已发布", views: 9800, publishedAt: "2026-04-25" },
  { id: 3, title: "Tailwind CSS v4 迁移笔记", status: "已发布", views: 8200, publishedAt: "2026-04-20" },
  { id: 4, title: "Vite 8 构建优化实践", status: "草稿", views: 0, publishedAt: "—" },
  { id: 5, title: "Next.js vs Remix 深度对比", status: "草稿", views: 0, publishedAt: "—" },
  { id: 6, title: "Docker 容器化部署教程", status: "已发布", views: 5100, publishedAt: "2026-04-10" },
  { id: 7, title: "Git 工作流最佳实践", status: "已发布", views: 4300, publishedAt: "2026-04-05" },
]

/** 状态筛选选项 */
const statusFilters: PostStatus[] = ["全部", "已发布", "草稿"]

/**
 * 文章管理页面
 * 提供文章列表展示、状态筛选和 CRUD 操作
 */
export default function Posts() {
  /** 当前选中的状态筛选 */
  const [activeFilter, setActiveFilter] = useState<PostStatus>("全部")

  /** 文章列表数据 */
  const [posts, setPosts] = useState<Post[]>(mockPosts)

  /**
   * 根据当前筛选条件过滤文章
   * @returns 过滤后的文章列表
   */
  const filteredPosts = activeFilter === "全部"
    ? posts
    : posts.filter((post) => post.status === activeFilter)

  /**
   * 切换文章发布状态
   * @param id - 文章 ID
   */
  function togglePublish(id: number) {
    setPosts((prev) =>
      prev.map((post) =>
        post.id === id
          ? {
              ...post,
              status: post.status === "已发布" ? "草稿" : "已发布",
              publishedAt: post.status === "草稿" ? new Date().toISOString().split("T")[0] : "—",
            }
          : post
      )
    )
  }

  /**
   * 删除文章
   * @param id - 文章 ID
   */
  function deletePost(id: number) {
    setPosts((prev) => prev.filter((post) => post.id !== id))
  }

  return (
    <div className="space-y-6">
      {/* 页面头部：标题和新建按钮 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">文章管理</h1>
          <p className="text-muted-foreground">管理所有博客文章</p>
        </div>
        <Button asChild>
          <Link to="/admin/posts/new">新建文章</Link>
        </Button>
      </div>

      {/* 状态筛选标签 */}
      <div className="flex gap-2">
        {statusFilters.map((filter) => (
          <Button
            key={filter}
            variant={activeFilter === filter ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFilter(filter)}
          >
            {filter}
          </Button>
        ))}
      </div>

      {/* 文章列表表格 */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>标题</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">浏览量</TableHead>
              <TableHead>发布时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPosts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  暂无文章数据
                </TableCell>
              </TableRow>
            ) : (
              filteredPosts.map((post) => (
                <TableRow key={post.id}>
                  <TableCell className="font-medium">{post.title}</TableCell>
                  <TableCell>
                    <Badge variant={post.status === "已发布" ? "default" : "secondary"}>
                      {post.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {post.views.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {post.publishedAt}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm">
                          ···
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to={`/admin/posts/${post.id}/edit`}>编辑</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => togglePublish(post.id)}>
                          {post.status === "已发布" ? "取消发布" : "发布"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => deletePost(post.id)}
                        >
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
