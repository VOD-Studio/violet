/**
 * 评论管理页面
 * 展示评论列表，支持状态筛选和审批操作
 */

import { useState } from "react"
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

/** 评论状态类型 */
type CommentStatus = "待审核" | "已通过" | "垃圾"

/** 评论数据项 */
interface Comment {
  /** 评论 ID */
  id: number
  /** 评论作者 */
  author: string
  /** 评论内容摘要 */
  content: string
  /** 评论所属文章标题 */
  postTitle: string
  /** 评论状态 */
  status: CommentStatus
  /** 评论时间 */
  createdAt: string
}

/** 评论示例数据 */
const mockComments: Comment[] = [
  {
    id: 1,
    author: "张三",
    content: "这篇文章写得非常详细，受益匪浅！",
    postTitle: "React 19 新特性解析",
    status: "已通过",
    createdAt: "2026-04-29 10:30",
  },
  {
    id: 2,
    author: "李四",
    content: "请问 TypeScript 6 的泛型推断有什么改进？",
    postTitle: "TypeScript 6 升级指南",
    status: "待审核",
    createdAt: "2026-04-29 09:15",
  },
  {
    id: 3,
    author: "王五",
    content: "Tailwind v4 的配置方式变化很大",
    postTitle: "Tailwind CSS v4 迁移笔记",
    status: "已通过",
    createdAt: "2026-04-28 18:45",
  },
  {
    id: 4,
    author: "匿名用户",
    content: "快来看看这个超低价商品...",
    postTitle: "Vite 8 构建优化实践",
    status: "垃圾",
    createdAt: "2026-04-28 15:20",
  },
  {
    id: 5,
    author: "赵六",
    content: "实际测试中发现了几个兼容性问题，希望能更新一下",
    postTitle: "Vite 8 构建优化实践",
    status: "待审核",
    createdAt: "2026-04-28 12:10",
  },
  {
    id: 6,
    author: "孙七",
    content: "感谢分享，已经成功部署到生产环境",
    postTitle: "Docker 容器化部署教程",
    status: "已通过",
    createdAt: "2026-04-27 20:30",
  },
]

/** 状态筛选选项 */
const statusFilters: { label: string; value: CommentStatus | "全部" }[] = [
  { label: "全部", value: "全部" },
  { label: "待审核", value: "待审核" },
  { label: "已通过", value: "已通过" },
  { label: "垃圾", value: "垃圾" },
]

/**
 * 评论管理页面
 * 提供评论列表展示、状态筛选和管理操作
 */
export default function Comments() {
  /** 当前选中的状态筛选 */
  const [activeFilter, setActiveFilter] = useState<CommentStatus | "全部">("全部")

  /** 评论列表数据 */
  const [comments, setComments] = useState<Comment[]>(mockComments)

  /**
   * 根据当前筛选条件过滤评论
   * @returns 过滤后的评论列表
   */
  const filteredComments =
    activeFilter === "全部"
      ? comments
      : comments.filter((c) => c.status === activeFilter)

  /**
   * 批准评论
   * @param id - 评论 ID
   */
  function approveComment(id: number) {
    setComments((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: "已通过" as const } : c))
    )
  }

  /**
   * 标记为垃圾评论
   * @param id - 评论 ID
   */
  function markAsSpam(id: number) {
    setComments((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: "垃圾" as const } : c))
    )
  }

  /**
   * 删除评论
   * @param id - 评论 ID
   */
  function deleteComment(id: number) {
    setComments((prev) => prev.filter((c) => c.id !== id))
  }

  /**
   * 根据状态返回对应的 Badge 变体
   * @param status - 评论状态
   * @returns Badge variant
   */
  function getStatusBadgeVariant(status: CommentStatus) {
    switch (status) {
      case "已通过":
        return "default"
      case "待审核":
        return "secondary"
      case "垃圾":
        return "destructive" as const
    }
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold">评论管理</h1>
        <p className="text-muted-foreground">审核和管理用户评论</p>
      </div>

      {/* 状态筛选标签 */}
      <div className="flex gap-2">
        {statusFilters.map((filter) => (
          <Button
            key={filter.value}
            variant={activeFilter === filter.value ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFilter(filter.value)}
          >
            {filter.label}
            {filter.value !== "全部" && (
              <span className="ml-1 text-xs">
                ({comments.filter((c) => c.status === filter.value).length})
              </span>
            )}
          </Button>
        ))}
      </div>

      {/* 评论列表表格 */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>作者</TableHead>
              <TableHead>内容</TableHead>
              <TableHead>文章</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredComments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  暂无评论数据
                </TableCell>
              </TableRow>
            ) : (
              filteredComments.map((comment) => (
                <TableRow key={comment.id}>
                  <TableCell className="font-medium">{comment.author}</TableCell>
                  <TableCell className="max-w-[240px] truncate">
                    {comment.content}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {comment.postTitle}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(comment.status)}>
                      {comment.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {comment.createdAt}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm">
                          ···
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {comment.status !== "已通过" && (
                          <DropdownMenuItem onClick={() => approveComment(comment.id)}>
                            批准
                          </DropdownMenuItem>
                        )}
                        {comment.status !== "垃圾" && (
                          <DropdownMenuItem onClick={() => markAsSpam(comment.id)}>
                            标记垃圾
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => deleteComment(comment.id)}
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
