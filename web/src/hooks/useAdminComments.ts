// 评论管理 Hooks
// 使用 react-query 管理评论相关的 API 调用

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

/* ========== 类型定义 ========== */

/** 评论结构 */
export interface ApiComment {
  /** 评论唯一标识 */
  id: string;
  /** 所属文章 ID */
  post_id: string;
  /** 父评论 ID */
  parent_id?: string;
  /** 评论者昵称 */
  author_name: string;
  /** 评论者邮箱 */
  author_email?: string;
  /** 评论者网站 */
  author_url?: string;
  /** 评论者头像 */
  avatar_url?: string;
  /** 评论内容 HTML */
  body_html: string;
  /** 评论状态 */
  status: "pending" | "approved" | "spam";
  /** 创建时间 */
  created_at: string;
  /** 子评论列表 */
  children?: ApiComment[];
}

/* ========== Hooks ========== */

/**
 * 获取待审核评论列表
 * API 返回 { comments: [...], total, page, page_size } 格式
 */
export function useAdminComments() {
  return useQuery({
    queryKey: ["admin", "comments", "pending"],
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
      queryClient.invalidateQueries({ queryKey: ["admin", "comments"] });
    },
  });

  const markSpam = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/comments/${id}/status`, { status: "spam" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "comments"] });
    },
  });

  const deleteComment = useMutation({
    mutationFn: (id: string) => api.del(`/comments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "comments"] });
    },
  });

  return { approve, markSpam, deleteComment };
}
