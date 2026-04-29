// 评论数据 Hook
// 使用 react-query 管理评论列表获取和评论提交

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"

/** 评论数据结构 */
interface Comment {
  id: string
  authorName: string
  authorEmail: string
  content: string
  createdAt: string
  replies: Comment[]
}

/** 提交评论的数据结构 */
interface CommentSubmitData {
  authorName: string
  authorEmail: string
  content: string
  parentId?: string
}

/**
 * 获取文章评论列表
 * @param postId 文章 ID
 */
export function useComments(postId: string | undefined) {
  return useQuery({
    queryKey: ["comments", postId],
    queryFn: () => api.get<Comment[]>(`/posts/${postId}/comments`),
    enabled: !!postId,
  })
}

/**
 * 提交评论的 mutation hook
 * @param postId 文章 ID
 */
export function useSubmitComment(postId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CommentSubmitData) => {
      if (!postId) throw new Error("缺少文章 ID")
      return api.post(`/posts/${postId}/comments`, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", postId] })
    },
  })
}

export type { Comment, CommentSubmitData }
