// 评论数据 Hook
// 提供评论列表获取和评论提交功能，支持嵌套评论树

import { useState, useEffect, useCallback } from "react"
import { api } from "@/lib/api"

/** 评论数据结构 */
interface Comment {
  /** 评论 ID */
  id: string
  /** 评论者名称 */
  authorName: string
  /** 评论者邮箱 */
  authorEmail: string
  /** 评论内容 */
  content: string
  /** 创建时间 */
  createdAt: string
  /** 子评论列表 */
  replies: Comment[]
}

/** 提交评论的数据结构 */
interface CommentSubmitData {
  /** 评论者名称 */
  authorName: string
  /** 评论者邮箱 */
  authorEmail: string
  /** 评论内容 */
  content: string
  /** 父评论 ID，为空则为顶层评论 */
  parentId?: string
}

/**
 * 获取文章评论列表
 * @param postId 文章 ID
 */
export function useComments(postId: string | undefined) {
  const [data, setData] = useState<Comment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /** 获取评论列表 */
  const fetchComments = useCallback(async () => {
    if (!postId) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const result = await api.get<Comment[]>(`/posts/${postId}/comments`)
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取评论失败")
    } finally {
      setIsLoading(false)
    }
  }, [postId])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  /**
   * 提交评论
   * @param commentData 评论内容
   * @returns 提交成功后刷新评论列表
   */
  const submitComment = useCallback(
    async (commentData: CommentSubmitData) => {
      if (!postId) throw new Error("缺少文章 ID")

      await api.post(`/posts/${postId}/comments`, commentData)
      /* 提交成功后刷新评论列表 */
      await fetchComments()
    },
    [postId, fetchComments],
  )

  return { data, isLoading, error, submitComment, refetch: fetchComments }
}

export type { Comment, CommentSubmitData }
