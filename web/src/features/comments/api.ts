/**
 * 评论功能 API 层
 * 使用 react-query 管理评论列表获取和评论提交
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Comment, CommentSubmitData, CommentReaction } from "./types";

/**
 * 获取文章评论列表
 * @param postId 文章 ID
 */
export function useComments(postId: string | undefined) {
  return useQuery({
    queryKey: ["comments", postId],
    queryFn: async () => {
      const res = await api.get<{ comments: Comment[] }>(
        `/posts/${postId}/comments`,
      );
      return res.comments ?? [];
    },
    enabled: !!postId,
  });
}

/**
 * 提交评论的 mutation hook
 * @param postId 文章 ID
 */
export function useSubmitComment(postId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CommentSubmitData) => {
      if (!postId) throw new Error("缺少文章 ID");
      return api.post(`/posts/${postId}/comments`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", postId] });
    },
  });
}

/**
 * 获取评论的表情反应
 * @param commentId 评论 ID
 */
export async function getCommentReactions(
  commentId: string,
): Promise<{ reactions: CommentReaction[] }> {
  return api.get(`/comments/${commentId}/reactions`);
}

/**
 * 添加表情反应
 * @param commentId 评论 ID
 * @param emojiId 表情 ID
 * @returns 更新后的 reactions 数据
 */
export async function addCommentReaction(
  commentId: string,
  emojiId: number,
): Promise<{ reactions: CommentReaction[] }> {
  return api.post(`/comments/${commentId}/reactions`, {
    emoji_id: emojiId,
  });
}

/**
 * 删除表情反应
 * @param commentId 评论 ID
 * @param emojiId 表情 ID
 * @returns 更新后的 reactions 数据
 */
export async function removeCommentReaction(
  commentId: string,
  emojiId: number,
): Promise<{ reactions: CommentReaction[] }> {
  return api.del(`/comments/${commentId}/reactions/${emojiId}`);
}

/**
 * 批量获取评论反应
 * @param commentIds 评论 ID 列表
 */
export async function getCommentReactionsBatch(
  commentIds: string[],
): Promise<{ reactions: Record<string, CommentReaction[]> }> {
  return api.post("/comments/reactions/batch", {
    comment_ids: commentIds,
  });
}

export type { Comment, CommentSubmitData, CommentReaction };
