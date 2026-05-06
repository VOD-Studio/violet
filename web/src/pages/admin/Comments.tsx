/**
 * 评论管理页面
 * 支持状态筛选、批量选择和批量操作
 * 使用 react-query 管理数据获取和变更
 */

import { useState, useMemo } from "react";
import {
  useAdminComments,
  useAdminCommentActions,
  useBatchUpdateStatus,
  useBatchDeleteComments,
  useCommentDetail,
} from "@/features/admin/comments/api";
import type { ApiComment, CommentStatusFilter } from "@/features/admin/comments/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorFallback } from "@/components/shared/ErrorFallback";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { CommentContent } from "@/features/comments";
import {
  MoreHorizontal,
  MessageSquare,
  CheckSquare,
  Square,
  Trash2,
  CheckCircle,
  XCircle,
  ExternalLink,
  Eye,
  User,
  Mail,
  Globe,
  Clock,
} from "lucide-react";
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

/**
 * 获取状态对应的 Badge 变体和文本
 */
function getStatusBadge(status: string) {
  switch (status) {
    case "approved":
      return { variant: "default" as const, label: "已批准" };
    case "pending":
      return { variant: "secondary" as const, label: "待审核" };
    case "spam":
      return { variant: "destructive" as const, label: "垃圾" };
    default:
      return { variant: "outline" as const, label: status };
  }
}

// 状态筛选显示文本映射
const statusFilterLabels: Record<CommentStatusFilter, string> = {
  all: "全部",
  pending: "待审核",
  approved: "已批准",
  spam: "垃圾",
};

/** 表格骨架屏 */
function CommentsTableSkeleton() {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Skeleton className="h-4 w-4" />
            </TableHead>
            <TableHead>作者</TableHead>
            <TableHead>内容</TableHead>
            <TableHead>文章</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>时间</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 4 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-4" />
              </TableCell>
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
                <Skeleton className="h-4 w-16" />
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
  const [statusFilter, setStatusFilter] = useState<CommentStatusFilter>("all");
  const { data, isLoading, error, refetch } = useAdminComments(statusFilter);
  const { approve, markSpam, deleteComment } = useAdminCommentActions();
  const batchUpdateStatus = useBatchUpdateStatus();
  const batchDelete = useBatchDeleteComments();

  // 选中的评论 ID 集合
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 删除确认弹窗状态
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    id: string;
    isBatch: boolean;
  }>({ open: false, id: "", isBatch: false });

  // 评论详情抽屉状态
  const [detailId, setDetailId] = useState<string | null>(null);
  const { data: detailComment, isLoading: detailLoading } = useCommentDetail(detailId);

  const comments = data?.comments ?? [];
  const isActing =
    approve.isPending ||
    markSpam.isPending ||
    deleteComment.isPending ||
    batchUpdateStatus.isPending ||
    batchDelete.isPending;

  // 全选/取消全选
  const isAllSelected =
    comments.length > 0 && comments.every((c) => selectedIds.has(c.id));
  const isPartialSelected =
    comments.some((c) => selectedIds.has(c.id)) && !isAllSelected;

  function toggleSelectAll() {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(comments.map((c) => c.id)));
    }
  }

  function toggleSelect(id: string) {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  }

  // 单个操作
  function handleApprove(id: string) {
    approve.mutate(id);
  }

  function handleMarkSpam(id: string) {
    markSpam.mutate(id);
  }

  function handleDelete(id: string) {
    setDeleteConfirm({ open: true, id, isBatch: false });
  }

  // 批量操作
  function handleBatchApprove() {
    if (selectedIds.size === 0) return;
    batchUpdateStatus.mutate({
      ids: Array.from(selectedIds),
      status: "approved",
    });
    setSelectedIds(new Set());
  }

  function handleBatchMarkSpam() {
    if (selectedIds.size === 0) return;
    batchUpdateStatus.mutate({
      ids: Array.from(selectedIds),
      status: "spam",
    });
    setSelectedIds(new Set());
  }

  function handleBatchDelete() {
    if (selectedIds.size === 0) return;
    setDeleteConfirm({ open: true, id: "", isBatch: true });
  }

  function confirmDelete() {
    if (deleteConfirm.isBatch) {
      batchDelete.mutate(Array.from(selectedIds));
      setSelectedIds(new Set());
    } else {
      deleteComment.mutate(deleteConfirm.id);
    }
    setDeleteConfirm({ open: false, id: "", isBatch: false });
  }

  // 筛选变更时清空选择
  function handleStatusChange(value: string) {
    setStatusFilter(value as CommentStatusFilter);
    setSelectedIds(new Set());
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold">评论管理</h1>
        <p className="text-muted-foreground">审核和管理用户评论</p>
      </div>

      {/* 筛选和批量操作工具栏 */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* 状态筛选下拉框 */}
          <Select
            value={statusFilter}
            onValueChange={handleStatusChange}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="筛选状态">
                {statusFilterLabels[statusFilter]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="pending">待审核</SelectItem>
              <SelectItem value="approved">已批准</SelectItem>
              <SelectItem value="spam">垃圾</SelectItem>
            </SelectContent>
          </Select>

          {/* 选中数量提示 */}
          {selectedIds.size > 0 && (
            <span className="text-sm text-muted-foreground">
              已选择 {selectedIds.size} 条评论
            </span>
          )}
        </div>

        {/* 批量操作按钮 */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="default"
              onClick={handleBatchApprove}
              disabled={isActing}
            >
              <CheckCircle className="mr-1.5 h-4 w-4" />
              批量批准
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleBatchMarkSpam}
              disabled={isActing}
            >
              <XCircle className="mr-1.5 h-4 w-4" />
              标记垃圾
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleBatchDelete}
              disabled={isActing}
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              批量删除
            </Button>
          </div>
        )}
      </div>

      {/* 加载态 */}
      {isLoading && <CommentsTableSkeleton />}

      {/* 错误状态 */}
      {error && <ErrorFallback error={error.message} onRetry={refetch} />}

      {/* 空数据状态 */}
      {!isLoading && !error && comments.length === 0 && (
        <EmptyState
          title={
            statusFilter === "all"
              ? "暂无评论"
              : statusFilter === "pending"
                ? "暂无待审核评论"
                : statusFilter === "approved"
                  ? "暂无已批准评论"
                  : "暂无垃圾评论"
          }
          description={
            statusFilter === "all"
              ? "还没有任何评论"
              : "所有评论都已审核完毕"
          }
          icon={<MessageSquare className="size-12" />}
        />
      )}

      {/* 评论列表表格 */}
      {!isLoading && !error && comments.length > 0 && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <button
                    onClick={toggleSelectAll}
                    className="flex size-5 cursor-pointer items-center justify-center rounded hover:bg-muted"
                    aria-label={isAllSelected ? "取消全选" : "全选"}
                  >
                    {isAllSelected ? (
                      <CheckSquare className="size-4 text-primary" />
                    ) : isPartialSelected ? (
                      <div className="size-3.5 rounded-sm border-2 border-primary bg-primary/50" />
                    ) : (
                      <Square className="size-4 text-muted-foreground" />
                    )}
                  </button>
                </TableHead>
                <TableHead>作者</TableHead>
                <TableHead>内容</TableHead>
                <TableHead>文章</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comments.map((comment: ApiComment) => {
                const isSelected = selectedIds.has(comment.id);
                const statusBadge = getStatusBadge(comment.status);

                return (
                  <TableRow key={comment.id} className={isSelected ? "bg-muted/50" : ""}>
                    <TableCell>
                      <button
                        onClick={() => toggleSelect(comment.id)}
                        className="flex size-5 cursor-pointer items-center justify-center rounded hover:bg-muted"
                        aria-label={isSelected ? "取消选择" : "选择"}
                      >
                        {isSelected ? (
                          <CheckSquare className="size-4 text-primary" />
                        ) : (
                          <Square className="size-4 text-muted-foreground" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {comment.avatar_url && (
                          <img
                            src={comment.avatar_url}
                            alt={comment.author_name}
                            className="size-6 rounded-full"
                          />
                        )}
                        <span>{comment.author_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      <div className="whitespace-pre-wrap break-words text-sm">
                        {comment.content?.message ?? comment.content ?? "-"}
                      </div>
                      {comment.content?.pictures &&
                        comment.content.pictures.length > 0 && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {comment.content.pictures.length} 张图片
                          </div>
                        )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {comment.post_title ?? comment.post_id ?? "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadge.variant}>
                        {statusBadge.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
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
                            onClick={() => setDetailId(comment.id)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            查看详情
                          </DropdownMenuItem>
                          {comment.status !== "approved" && (
                            <DropdownMenuItem
                              onClick={() => handleApprove(comment.id)}
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              批准
                            </DropdownMenuItem>
                          )}
                          {comment.status !== "spam" && (
                            <DropdownMenuItem
                              onClick={() => handleMarkSpam(comment.id)}
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              标记垃圾
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(comment.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* 删除确认弹窗 */}
      <ConfirmDialog
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, id: "", isBatch: false })}
        onConfirm={confirmDelete}
        title={
          deleteConfirm.isBatch
            ? `删除 ${selectedIds.size} 条评论`
            : "删除评论"
        }
        description={
          deleteConfirm.isBatch
            ? `确定要删除选中的 ${selectedIds.size} 条评论吗？此操作不可撤销。`
            : "确定要删除这条评论吗？此操作不可撤销。"
        }
        confirmLabel="删除"
        destructive
      />

      {/* 评论详情抽屉 */}
      <Sheet open={!!detailId} onOpenChange={(open) => !open && setDetailId(null)}>
        <SheetContent side="right" className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>评论详情</SheetTitle>
          </SheetHeader>

          {detailLoading && (
            <div className="space-y-4 p-6">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}

          {detailComment && (
            <div className="flex-1 space-y-4 p-6">
              {/* 作者信息 */}
              <div className="flex items-center gap-3">
                {detailComment.avatar_url ? (
                  <img
                    src={detailComment.avatar_url}
                    alt={detailComment.author_name}
                    className="size-10 rounded-full"
                  />
                ) : (
                  <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                    <User className="size-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{detailComment.author_name}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {detailComment.author_email && (
                      <span className="truncate">{detailComment.author_email}</span>
                    )}
                  </div>
                </div>
                <Badge variant={getStatusBadge(detailComment.status).variant}>
                  {getStatusBadge(detailComment.status).label}
                </Badge>
              </div>

              {/* 评论内容 */}
              <div className="rounded-lg border bg-muted/30 p-4">
                {detailComment.content ? (
                  <CommentContent
                    content={detailComment.content}
                    className="whitespace-pre-wrap break-words"
                  />
                ) : (
                  <p className="text-muted-foreground">无内容</p>
                )}
              </div>

              {/* 元信息 */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground border-t pt-4">
                <div className="flex items-center gap-1.5">
                  <Clock className="size-4" />
                  <span>{formatDateTime(detailComment.created_at)}</span>
                </div>
                {detailComment.author_url && (
                  <a
                    href={detailComment.author_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-primary hover:underline"
                  >
                    <Globe className="size-4" />
                    <span className="truncate max-w-[150px]">网站</span>
                  </a>
                )}
              </div>

              {/* 所属文章 */}
              <div className="rounded-lg border p-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">所属文章：</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate max-w-[200px]">
                    {detailComment.post_title ?? "未知文章"}
                  </span>
                  {detailComment.post_id && (
                    <a
                      href={`/posts/${detailComment.post_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline text-sm"
                    >
                      查看
                    </a>
                  )}
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-2 border-t pt-4">
                {detailComment.status !== "approved" && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      handleApprove(detailComment.id);
                      setDetailId(null);
                    }}
                    disabled={isActing}
                  >
                    <CheckCircle className="mr-1.5 h-4 w-4" />
                    批准
                  </Button>
                )}
                {detailComment.status !== "spam" && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      handleMarkSpam(detailComment.id);
                      setDetailId(null);
                    }}
                    disabled={isActing}
                  >
                    <XCircle className="mr-1.5 h-4 w-4" />
                    标记垃圾
                  </Button>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setDetailId(null);
                    handleDelete(detailComment.id);
                  }}
                  disabled={isActing}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  删除
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}