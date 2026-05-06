// 评论管理 API Hooks
// 使用 react-query 管理评论相关的 API 调用

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { commentKeys } from "./queryKeys";
import type { ApiComment, CommentStatusFilter, CommentStats } from "./types";

interface CommentsListResponse {
  comments: ApiComment[];
  total: number;
  page: number;
  page_size: number;
}

/**
 * 获取评论列表（支持状态筛选）
 * API 返回 { comments: [...], total, page, page_size } 格式
 */
export function useAdminComments(status: CommentStatusFilter = "all") {
  return useQuery({
    queryKey: commentKeys.list(status),
    queryFn: async () => {
      // 构建 API endpoint
      let endpoint = "/admin/comments";
      if (status !== "all") {
        endpoint += `?status=${status}`;
      }
      const res = await api.get<CommentsListResponse>(endpoint);
      return {
        comments: res.comments ?? [],
        total: res.total ?? 0,
        page: res.page ?? 1,
        pageSize: res.page_size ?? 20,
      };
    },
  });
}

/**
 * 获取评论统计信息
 */
export function useCommentStats() {
  return useQuery({
    queryKey: commentKeys.stats(),
    queryFn: async (): Promise<CommentStats> => {
      // 并行获取各状态数量
      const [pendingRes] = await Promise.all([
        api.get<{ count: number }>("/admin/comments/pending/count"),
      ]);
      return {
        pending: pendingRes.count ?? 0,
        approved: 0, // 后端暂不支持
        spam: 0, // 后端暂不支持
        total: pendingRes.count ?? 0,
      };
    },
  });
}

/**
 * 评论操作 mutation hook
 */
export function useAdminCommentActions() {
  const queryClient = useQueryClient();

  const approve = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/comments/${id}/status`, { status: "approved" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentKeys.all });
    },
  });

  const markSpam = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/comments/${id}/status`, { status: "spam" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentKeys.all });
    },
  });

  const deleteComment = useMutation({
    mutationFn: (id: string) => api.del(`/comments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentKeys.all });
    },
  });

  return { approve, markSpam, deleteComment };
}

/**
 * 批量更新评论状态
 */
export function useBatchUpdateStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      ids,
      status,
    }: {
      ids: string[];
      status: "approved" | "spam" | "pending" | "deleted";
    }) =>
      api.patch("/admin/comments/batch-status", {
        ids,
        status,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentKeys.all });
    },
  });
}

/**
 * 批量删除评论
 */
export function useBatchDeleteComments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) =>
      api.patch("/admin/comments/batch-status", {
        ids,
        status: "deleted",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentKeys.all });
    },
  });
}
