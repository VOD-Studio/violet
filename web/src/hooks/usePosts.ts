// 文章数据 Hook
// 提供文章列表查询（支持分页、标签筛选、搜索）和单篇文章详情获取

import { useState, useEffect } from "react"
import { api } from "@/lib/api"

/** 文章基本信息 */
interface Post {
  /** 文章 ID */
  id: string
  /** 文章标题 */
  title: string
  /** URL 别名 */
  slug: string
  /** 文章摘要 */
  summary: string
  /** 封面图地址 */
  coverImage?: string
  /** 发布时间 */
  createdAt: string
  /** 更新时间 */
  updatedAt?: string
  /** 浏览量 */
  views: number
  /** 作者信息 */
  author?: {
    id: string
    username: string
    avatar?: string
  }
  /** 标签列表 */
  tags: Array<{
    id: string
    name: string
    slug: string
  }>
}

/** 文章详情，包含正文内容 */
interface PostDetail extends Post {
  /** 文章正文 HTML */
  content: string
}

/** 分页响应结构 */
interface PaginatedPosts {
  /** 文章列表 */
  posts: Post[]
  /** 总数量 */
  total: number
  /** 当前页码 */
  page: number
  /** 每页数量 */
  limit: number
}

/** 文章列表查询参数 */
interface PostsParams {
  /** 页码 */
  page?: number
  /** 每页数量 */
  limit?: number
  /** 标签筛选 */
  tag?: string
  /** 搜索关键词 */
  search?: string
}

/**
 * 获取文章列表
 * 支持分页、标签筛选和关键词搜索
 * @param params 查询参数
 */
export function usePosts(params: PostsParams = {}) {
  const [data, setData] = useState<PaginatedPosts | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /** 将参数对象序列化为查询字符串 */
  const queryString = (() => {
    const searchParams = new URLSearchParams()
    if (params.page) searchParams.set("page", String(params.page))
    if (params.limit) searchParams.set("limit", String(params.limit))
    if (params.tag) searchParams.set("tag", params.tag)
    if (params.search) searchParams.set("search", params.search)
    const str = searchParams.toString()
    return str ? `?${str}` : ""
  })()

  useEffect(() => {
    let cancelled = false

    async function fetchPosts() {
      setIsLoading(true)
      setError(null)
      try {
        const result = await api.get<PaginatedPosts>(`/posts${queryString}`)
        if (!cancelled) {
          setData(result)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "获取文章列表失败")
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    fetchPosts()

    return () => {
      cancelled = true
    }
  }, [queryString])

  return { data, isLoading, error }
}

/**
 * 获取单篇文章详情
 * @param slug 文章 URL 别名
 */
export function usePost(slug: string | undefined) {
  const [data, setData] = useState<PostDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function run() {
      if (!slug) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)
      try {
        const result = await api.get<PostDetail>(`/posts/${slug}`)
        if (!cancelled) setData(result)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "获取文章详情失败")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [slug])

  return { data, isLoading, error }
}

export type { Post, PostDetail, PaginatedPosts, PostsParams }
