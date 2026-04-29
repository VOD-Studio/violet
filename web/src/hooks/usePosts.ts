// 文章数据 Hook
// 使用 react-query 管理文章列表查询和单篇文章详情

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"

/** 文章基本信息 */
interface Post {
  id: string
  title: string
  slug: string
  summary: string
  coverImage?: string
  createdAt: string
  updatedAt?: string
  views: number
  author?: {
    id: string
    username: string
    avatar?: string
  }
  tags: Array<{
    id: string
    name: string
    slug: string
  }>
}

/** 文章详情，包含正文内容 */
interface PostDetail extends Post {
  content: string
}

/** 分页响应结构 */
interface PaginatedPosts {
  posts: Post[]
  total: number
  page: number
  limit: number
}

/** 文章列表查询参数 */
interface PostsParams {
  page?: number
  limit?: number
  tag?: string
  search?: string
}

/**
 * 获取文章列表
 * 支持分页、标签筛选和关键词搜索
 */
export function usePosts(params: PostsParams = {}) {
  const { page = 1, limit = 6, tag, search } = params

  return useQuery({
    queryKey: ["posts", { page, limit, tag, search }],
    queryFn: () => {
      const searchParams = new URLSearchParams()
      searchParams.set("page", String(page))
      searchParams.set("limit", String(limit))
      if (tag) searchParams.set("tag", tag)
      if (search) searchParams.set("search", search)
      return api.get<PaginatedPosts>(`/posts?${searchParams.toString()}`)
    },
  })
}

/**
 * 获取单篇文章详情
 * @param slug 文章 URL 别名
 */
export function usePost(slug: string | undefined) {
  return useQuery({
    queryKey: ["posts", slug],
    queryFn: () => api.get<PostDetail>(`/posts/${slug}`),
    enabled: !!slug,
  })
}

/**
 * 删除文章的 mutation hook
 */
export function useDeletePost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => api.del(`/posts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] })
    },
  })
}

export type { Post, PostDetail, PaginatedPosts, PostsParams }
