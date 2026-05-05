/**
 * 评论表情反应 Hooks
 * 使用 React Query 管理表情反应的状态和缓存
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getCommentReactions,
  addCommentReaction,
  removeCommentReaction,
} from "../api";
import type { CommentReaction } from "../types";

/**
 * 获取评论反应
 * @param commentId 评论 ID
 * @param enabled 是否启用自动获取（默认禁用，因为数据已在评论接口中返回）
 * @returns 评论反应查询结果
 */
export function useCommentReactions(commentId: string, enabled = false) {
  return useQuery({
    queryKey: ["comment-reactions", commentId],
    queryFn: () => getCommentReactions(commentId),
    staleTime: 5 * 60 * 1000, // 5分钟内不重新请求
    enabled, // 默认禁用自动获取
  });
}

/**
 * 添加表情反应
 * @param commentId 评论 ID
 * @param postId 文章 ID（用于刷新评论列表）
 * @returns 添加表情反应的 mutation
 */
export function useAddReaction(commentId: string, postId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (emojiId: number) => addCommentReaction(commentId, emojiId),
    onSuccess: () => {
      // 刷新评论列表，评论数据中包含最新的 reactions
      if (postId) {
        queryClient.invalidateQueries({
          queryKey: ["comments", postId],
        });
      }
    },
    onError: (error) => {
      // 优先使用接口返回的错误信息
      const message = error?.message;
      if (message) {
        toast.error(message);
      } else {
        toast.error("添加表情失败，请稍后重试");
      }
    },
  });
}

/**
 * 删除表情反应
 * @param commentId 评论 ID
 * @param postId 文章 ID（用于刷新评论列表）
 * @returns 删除表情反应的 mutation
 */
export function useRemoveReaction(commentId: string, postId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (emojiId: number) => removeCommentReaction(commentId, emojiId),
    onSuccess: () => {
      // 刷新评论列表
      if (postId) {
        queryClient.invalidateQueries({
          queryKey: ["comments", postId],
        });
      }
    },
    onError: (error: any) => {
      // 优先使用接口返回的错误信息
      const message = error.response?.data?.message || error?.message;
      if (message) {
        toast.error(message);
      } else if (error.response?.status === 404) {
        toast.error("未找到该表情反应");
      } else if (error.response?.status === 429) {
        toast.error("操作过于频繁，请稍后再试");
      } else {
        toast.error("删除表情失败，请稍后重试");
      }
    },
  });
}
