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
 * @returns 评论反应查询结果
 */
export function useCommentReactions(commentId: string) {
  return useQuery({
    queryKey: ["comment-reactions", commentId],
    queryFn: () => getCommentReactions(commentId),
    staleTime: 5 * 60 * 1000, // 5分钟内不重新请求
  });
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
    onMutate: async (emojiId: number) => {
      // 取消正在进行的查询
      await queryClient.cancelQueries({
        queryKey: ["comment-reactions", commentId],
      });

      // 获取当前数据快照
      const previousData = queryClient.getQueryData<{
        reactions: CommentReaction[];
      }>(["comment-reactions", commentId]);

      // 乐观更新：立即更新 UI
      if (previousData) {
        const existingReaction = previousData.reactions.find(
          (r) => r.emoji_id === emojiId,
        );

        if (existingReaction) {
          // 如果表情已存在，增加计数并标记为已反应
          queryClient.setQueryData<{ reactions: CommentReaction[] }>(
            ["comment-reactions", commentId],
            {
              reactions: previousData.reactions.map((r) =>
                r.emoji_id === emojiId
                  ? { ...r, count: r.count + 1, user_reacted: true }
                  : r,
              ),
            },
          );
        } else {
          // 如果表情不存在，添加新的反应（暂时没有完整信息）
          // 实际数据会在请求成功后更新
          queryClient.setQueryData<{ reactions: CommentReaction[] }>(
            ["comment-reactions", commentId],
            {
              reactions: [
                ...previousData.reactions,
                {
                  emoji_id: emojiId,
                  emoji_name: "",
                  count: 1,
                  user_reacted: true,
                },
              ],
            },
          );
        }
      }

      return { previousData };
    },
    onSuccess: () => {
      // 请求成功后刷新数据，获取完整的表情信息
      queryClient.invalidateQueries({
        queryKey: ["comment-reactions", commentId],
      });
    },
    onError: (error: any, _emojiId, context) => {
      // 回滚乐观更新
      if (context?.previousData) {
        queryClient.setQueryData(
          ["comment-reactions", commentId],
          context.previousData,
        );
      }

      // 显示错误提示
      if (error.response?.status === 409) {
        toast.error("您已经添加过这个表情了");
      } else if (error.response?.status === 404) {
        toast.error("评论或表情不存在");
      } else if (error.response?.status === 429) {
        toast.error("操作过于频繁，请稍后再试");
      } else {
        toast.error("添加表情失败，请稍后重试");
      }
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
    onMutate: async (emojiId: number) => {
      // 取消正在进行的查询
      await queryClient.cancelQueries({
        queryKey: ["comment-reactions", commentId],
      });

      // 获取当前数据快照
      const previousData = queryClient.getQueryData<{
        reactions: CommentReaction[];
      }>(["comment-reactions", commentId]);

      // 乐观更新：立即更新 UI
      if (previousData) {
        queryClient.setQueryData<{ reactions: CommentReaction[] }>(
          ["comment-reactions", commentId],
          {
            reactions: previousData.reactions
              .map((r) =>
                r.emoji_id === emojiId
                  ? { ...r, count: r.count - 1, user_reacted: false }
                  : r,
              )
              .filter((r) => r.count > 0), // 移除计数为 0 的反应
          },
        );
      }

      return { previousData };
    },
    onSuccess: () => {
      // 请求成功后刷新数据
      queryClient.invalidateQueries({
        queryKey: ["comment-reactions", commentId],
      });
    },
    onError: (error: any, _emojiId, context) => {
      // 回滚乐观更新
      if (context?.previousData) {
        queryClient.setQueryData(
          ["comment-reactions", commentId],
          context.previousData,
        );
      }

      // 显示错误提示
      if (error.response?.status === 404) {
        toast.error("未找到该表情反应");
      } else if (error.response?.status === 429) {
        toast.error("操作过于频繁，请稍后再试");
      } else {
        toast.error("删除表情失败，请稍后重试");
      }
    },
  });
}
