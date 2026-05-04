/**
 * 批量获取评论表情反应 Hook
 * 解决 N+1 查询问题，一次请求获取多个评论的反应数据
 */

import { useQuery } from "@tanstack/react-query";
import { getCommentReactionsBatch } from "../api";

/**
 * 批量获取评论反应
 * @param commentIds 评论 ID 列表
 * @returns 批量查询结果，返回 commentId -> reactions 的映射
 */
export function useCommentReactionsBatch(commentIds: string[]) {
  // 对 ID 排序以确保相同的 ID 集合生成相同的 queryKey
  const sortedIds = [...commentIds].sort();
  const queryKey = sortedIds.join(",");

  return useQuery({
    queryKey: ["comment-reactions-batch", queryKey],
    queryFn: async () => {
      const result = await getCommentReactionsBatch(sortedIds);
      return result.reactions;
    },
    staleTime: 5 * 60 * 1000, // 5分钟内不重新请求
    enabled: commentIds.length > 0,
  });
}
