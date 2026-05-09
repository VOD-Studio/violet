/**
 * 评论管理页面
 * 支持状态筛选、批量选择和批量操作
 * 使用 react-query 管理数据获取和变更
 */

import { useState } from "react";
import {
  useAdminComments,
  useAdminCommentActions,
  useBatchUpdateStatus,
  useBatchDeleteComments,
  useCommentDetail,
} from "@/features/admin/comments/api";
import type { CommentStatusFilter } from "@/features/admin/comments/types";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorFallback } from "@/components/shared/ErrorFallback";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { MessageSquare } from "lucide-react";
import { CommentDetailSheet } from "./components/CommentDetailSheet";
import { CommentsTable } from "./components/CommentsTable";
import { CommentsTableSkeleton } from "./components/CommentsTableSkeleton";
import { CommentsToolbar } from "./components/CommentsToolbar";

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
  const { data: detailComment, isLoading: detailLoading } =
    useCommentDetail(detailId);

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

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(comments.map((c) => c.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  // 单个操作
  const handleApprove = (id: string) => {
    approve.mutate(id);
  };

  const handleMarkSpam = (id: string) => {
    markSpam.mutate(id);
  };

  const handleDelete = (id: string) => {
    setDeleteConfirm({ open: true, id, isBatch: false });
  };

  // 批量操作
  const handleBatchApprove = () => {
    if (selectedIds.size === 0) return;
    batchUpdateStatus.mutate({
      ids: Array.from(selectedIds),
      status: "approved",
    });
    setSelectedIds(new Set());
  };

  const handleBatchMarkSpam = () => {
    if (selectedIds.size === 0) return;
    batchUpdateStatus.mutate({
      ids: Array.from(selectedIds),
      status: "spam",
    });
    setSelectedIds(new Set());
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    setDeleteConfirm({ open: true, id: "", isBatch: true });
  };

  const confirmDelete = () => {
    if (deleteConfirm.isBatch) {
      batchDelete.mutate(Array.from(selectedIds));
      setSelectedIds(new Set());
    } else {
      deleteComment.mutate(deleteConfirm.id);
    }
    setDeleteConfirm({ open: false, id: "", isBatch: false });
  };

  // 筛选变更时清空选择
  const handleStatusChange = (
    value: "all" | "pending" | "approved" | "spam" | null
  ) => {
    if (value) {
      setStatusFilter(value);
      setSelectedIds(new Set());
    }
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold">评论管理</h1>
        <p className="text-muted-foreground">审核和管理用户评论</p>
      </div>

      {/* 筛选和批量操作工具栏 */}
      <CommentsToolbar
        statusFilter={statusFilter}
        onStatusChange={handleStatusChange}
        selectedCount={selectedIds.size}
        isActing={isActing}
        onBatchApprove={handleBatchApprove}
        onBatchMarkSpam={handleBatchMarkSpam}
        onBatchDelete={handleBatchDelete}
      />

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
            statusFilter === "all" ? "还没有任何评论" : "所有评论都已审核完毕"
          }
          icon={<MessageSquare className="size-12" />}
        />
      )}

      {/* 评论列表表格 */}
      {!isLoading && !error && comments.length > 0 && (
        <CommentsTable
          comments={comments}
          selectedIds={selectedIds}
          isAllSelected={isAllSelected}
          isPartialSelected={isPartialSelected}
          isActing={isActing}
          onToggleSelectAll={toggleSelectAll}
          onToggleSelect={toggleSelect}
          onViewDetail={setDetailId}
          onApprove={handleApprove}
          onMarkSpam={handleMarkSpam}
          onDelete={handleDelete}
        />
      )}

      {/* 删除确认弹窗 */}
      <ConfirmDialog
        open={deleteConfirm.open}
        onClose={() =>
          setDeleteConfirm({ open: false, id: "", isBatch: false })
        }
        onConfirm={confirmDelete}
        title={
          deleteConfirm.isBatch ? `删除 ${selectedIds.size} 条评论` : "删除评论"
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
      <CommentDetailSheet
        open={!!detailId}
        onClose={() => setDetailId(null)}
        comment={detailComment}
        isLoading={detailLoading}
        isActing={isActing}
        onApprove={handleApprove}
        onMarkSpam={handleMarkSpam}
        onDelete={handleDelete}
      />
    </div>
  );
}
