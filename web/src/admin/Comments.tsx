/**
 * 评论管理页面
 * 调用 API 获取待审核评论，支持批准、标记垃圾和删除操作
 */

import { useState } from "react"
import {
  useAdminComments,
  useAdminCommentActions,
} from "@/hooks/useAdmin"
import type { ApiComment } from "@/hooks/useAdmin"
import { Button } from "@/components/ui/button"
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

/**
 * 将 ISO 日期字符串格式化为本地日期时间
 * @param isoString - ISO 格式的日期字符串
 * @returns 格式化后的日期时间
 */
function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString("zh-CN")
}

/**
 * 评论管理页面
 * 展示待审核评论列表，提供批准、标记垃圾和删除功能
 */
export default function Comments() {
  /** 获取待审核评论列表 */
  const { comments, isLoading, error, refetch } = useAdminComments()
  /** 评论操作函数 */
  const { approve, markSpam, deleteComment } = useAdminCommentActions()

  /** 操作中的评论 ID，用于禁用按钮防止重复点击 */
  const [actingId, setActingId] = useState<number | null>(null)

  /**
   * 批准评论
   * @param id - 评论 ID
   */
  async function handleApprove(id: number) {
    try {
      setActingId(id)
      await approve(id)
      refetch()
    } catch {
      /* 错误由 API 层抛出 */
    } finally {
      setActingId(null)
    }
  }

  /**
   * 标记为垃圾评论
   * @param id - 评论 ID
   */
  async function handleMarkSpam(id: number) {
    try {
      setActingId(id)
      await markSpam(id)
      refetch()
    } catch {
      /* 错误由 API 层抛出 */
    } finally {
      setActingId(null)
    }
  }

  /**
   * 删除评论（带确认提示）
   * @param id - 评论 ID
   */
  async function handleDelete(id: number) {
    if (!window.confirm("确定要删除这条评论吗？此操作不可撤销。")) return
    try {
      setActingId(id)
      await deleteComment(id)
      refetch()
    } catch {
      /* 错误由 API 层抛出 */
    } finally {
      setActingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold">评论管理</h1>
        <p className="text-muted-foreground">审核和管理用户评论</p>
      </div>

      {/* 加载与错误状态 */}
      {isLoading && <p className="text-muted-foreground">加载中...</p>}
      {error && <p className="text-destructive">{error}</p>}

      {/* 评论列表表格 */}
      {!isLoading && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>作者</TableHead>
                <TableHead>内容</TableHead>
                <TableHead>文章</TableHead>
                <TableHead>时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comments.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-muted-foreground"
                  >
                    暂无待审核评论
                  </TableCell>
                </TableRow>
              ) : (
                comments.map((comment: ApiComment) => (
                  <TableRow key={comment.id}>
                    <TableCell className="font-medium">
                      {comment.authorName}
                    </TableCell>
                    <TableCell className="max-w-[240px] truncate">
                      {comment.content}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {comment.post?.title ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(comment.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={actingId === comment.id}
                          >
                            ···
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleApprove(comment.id)}
                          >
                            批准
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleMarkSpam(comment.id)}
                          >
                            标记垃圾
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(comment.id)}
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
      )}
    </div>
  )
}
