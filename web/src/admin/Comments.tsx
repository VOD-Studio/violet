/**
 * 评论管理页面
 * 调用 API 获取待审核评论，支持批准、标记垃圾和删除操作
 * 使用 react-query 管理数据获取和变更
 */

import { useState } from "react";
import { useAdminComments, useAdminCommentActions } from "@/hooks/useAdmin";
import type { ApiComment } from "@/hooks/useAdmin";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorFallback } from "@/components/shared/ErrorFallback";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { MoreHorizontal, MessageSquare } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * 将 ISO 日期字符串格式化为本地日期时间
 */
function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString("zh-CN");
}

/** 表格骨架屏 */
function CommentsTableSkeleton() {
  return (
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
          {Array.from({ length: 4 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-40" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-32" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-8 ml-auto" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * 评论管理页面
 */
export default function Comments() {
  const { data: comments, isLoading, error, refetch } = useAdminComments();
  const { approve, markSpam, deleteComment } = useAdminCommentActions();

  /** 删除确认弹窗状态 */
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    id: string;
  }>({ open: false, id: "" });

  const isActing =
    approve.isPending || markSpam.isPending || deleteComment.isPending;

  /**
   * 批准评论
   */
  function handleApprove(id: string) {
    approve.mutate(id);
  }

  /**
   * 标记为垃圾评论
   */
  function handleMarkSpam(id: string) {
    markSpam.mutate(id);
  }

  /**
   * 弹出删除确认
   */
  function handleDelete(id: string) {
    setDeleteConfirm({ open: true, id });
  }

  /**
   * 确认删除
   */
  function confirmDelete() {
    deleteComment.mutate(deleteConfirm.id);
    setDeleteConfirm({ open: false, id: "" });
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold">评论管理</h1>
        <p className="text-muted-foreground">审核和管理用户评论</p>
      </div>

      {/* 加载态 */}
      {isLoading && <CommentsTableSkeleton />}

      {/* 错误状态 */}
      {error && <ErrorFallback error={error.message} onRetry={refetch} />}

      {/* 空数据状态 */}
      {!isLoading && !error && (!comments || comments.length === 0) && (
        <EmptyState
          title="暂无待审核评论"
          description="所有评论都已审核完毕"
          icon={<MessageSquare className="size-12" />}
        />
      )}

      {/* 评论列表表格 */}
      {!isLoading && !error && comments && comments.length > 0 && (
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
              {comments.map((comment: ApiComment) => (
                <TableRow key={comment.id}>
                  <TableCell className="font-medium">
                    {comment.author_name}
                  </TableCell>
                  <TableCell className="max-w-[240px] truncate">
                    {comment.body_html}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {comment.post_id ?? "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(comment.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="flex size-8 cursor-pointer items-center justify-center rounded-md hover:bg-muted"
                        disabled={isActing}
                      >
                        <MoreHorizontal className="size-4" />
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
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* 删除确认弹窗 */}
      <ConfirmDialog
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, id: "" })}
        onConfirm={confirmDelete}
        title="删除评论"
        description="确定要删除这条评论吗？此操作不可撤销。"
        confirmLabel="删除"
        destructive
      />
    </div>
  );
}
