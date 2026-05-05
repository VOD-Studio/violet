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
import type { Comment, CommentReaction } from "../types";

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
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

/**
 * 更新评论缓存中的 reactions
 */
function updateCommentReactions(
  queryClient: ReturnType<typeof useQueryClient>,
  commentId: string,
  reactions: CommentReaction[]
) {
  // 查找所有评论查询的缓存
  const commentsQueries = queryClient.getQueriesData<Comment[]>({
    queryKey: ["comments"],
  });

  for (const [queryKey, data] of commentsQueries) {
    if (!data) continue;

    // 递归查找并更新指定评论的 reactions
    const updateComment = (comment: Comment): Comment => {
      if (comment.id === commentId) {
        return { ...comment, reactions };
      }
      if (comment.children) {
        return {
          ...comment,
          children: comment.children.map(updateComment),
        };
      }
      return comment;
    };

    // 缓存数据是数组，直接更新
    queryClient.setQueryData(queryKey, data.map(updateComment));
  }
}

/**
 * 添加表情反应
 * @param commentId 评论 ID
 * @returns 添加表情反应的 mutation
 */
export function useAddReaction(commentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (emojiId: number) => addCommentReaction(commentId, emojiId),
    onSuccess: (data) => {
      // 用接口返回的 reactions 更新评论缓存
      updateCommentReactions(queryClient, commentId, data.reactions);
    },
    onError: (error) => {
      const message = error?.message;
      toast.error(message || "添加表情失败，请稍后重试");
    },
  });
}

/**
 * 删除表情反应
 * @param commentId 评论 ID
 * @returns 删除表情反应的 mutation
 */
export function useRemoveReaction(commentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (emojiId: number) => removeCommentReaction(commentId, emojiId),
    onSuccess: (data) => {
      // 用接口返回的 reactions 更新评论缓存
      updateCommentReactions(queryClient, commentId, data.reactions);
    },
    onError: (error: any) => {
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
