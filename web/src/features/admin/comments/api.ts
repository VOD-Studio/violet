// 评论管理 API Hooks
// 使用 react-query 管理评论相关的 API 调用

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { commentKeys } from "./queryKeys";
import type { ApiComment } from "./types";

/**
 * 获取待审核评论列表
 * API 返回 { comments: [...], total, page, page_size } 格式
 */
export function useAdminComments() {
  return useQuery({
    queryKey: commentKeys.pending(),
    queryFn: async () => {
      const res = await api.get<{ comments: ApiComment[] }>(
        "/admin/comments/pending",
      );
      return res.comments ?? [];
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
