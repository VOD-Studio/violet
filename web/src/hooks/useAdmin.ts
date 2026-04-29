// 后台管理数据 Hook
// 提供仪表盘统计、文章管理、评论管理相关的数据获取和操作

import { useState, useEffect, useCallback } from "react"
import { api } from "@/lib/api"

/* ========== 类型定义 ========== */

/** 文章状态类型 */
type PostStatus = "draft" | "published"

/** 后端返回的文章结构 */
interface ApiPost {
  /** 文章 ID */
  id: number
  /** 文章标题 */
  title: string
  /** URL 别名 */
  slug: string
  /** 文章摘要 */
  excerpt?: string
  /** 文章内容 */
  content?: string
  /** 文章状态 */
  status: PostStatus
  /** 浏览量 */
  views: number
  /** 封面图地址 */
  coverImage?: string
  /** SEO 描述 */
  seoDescription?: string
  /** SEO 关键词 */
  seoKeywords?: string
  /** 关联标签 */
  tags?: ApiTag[]
  /** 创建时间 */
  createdAt: string
  /** 更新时间 */
  updatedAt: string
  /** 发布时间 */
  publishedAt?: string | null
}

/** 标签结构 */
interface ApiTag {
  /** 标签 ID */
  id: number
  /** 标签名称 */
  name: string
  /** URL 别名 */
  slug: string
}

/** 评论结构 */
interface ApiComment {
  /** 评论 ID */
  id: number
  /** 评论作者名称 */
  authorName: string
  /** 评论内容 */
  content: string
  /** 评论状态 */
  status: "pending" | "approved" | "spam"
  /** 所属文章 */
  post?: {
    /** 文章 ID */
    id: number
    /** 文章标题 */
    title: string
    /** 文章别名 */
    slug: string
  }
  /** 创建时间 */
  createdAt: string
}

/** 文章列表查询参数 */
interface PostListParams {
  /** 页码 */
  page?: number
  /** 每页数量 */
  limit?: number
  /** 状态筛选 */
  status?: PostStatus
}

/** 分页响应结构 */
interface PaginatedResponse<T> {
  /** 数据列表 */
  items: T[]
  /** 总数量 */
  total: number
  /** 当前页码 */
  page: number
  /** 每页数量 */
  limit: number
  /** 总页数 */
  totalPages: number
}

/** 创建/更新文章的请求体 */
interface PostFormData {
  /** 文章标题 */
  title: string
  /** 文章内容 */
  content: string
  /** 文章摘要 */
  excerpt?: string
  /** 文章状态 */
  status?: PostStatus
  /** 标签 ID 列表 */
  tagIds?: number[]
  /** 封面图地址 */
  coverImage?: string
  /** SEO 描述 */
  seoDescription?: string
  /** SEO 关键词 */
  seoKeywords?: string
}

/* ========== 仪表盘统计 Hook ========== */

/** 热门文章结构 */
interface PopularPost {
  /** 文章 ID */
  id: number
  /** 文章标题 */
  title: string
  /** URL 别名 */
  slug: string
  /** 浏览量 */
  views: number
}

/** 仪表盘统计数据结构，对应 GET /api/admin/stats 返回值 */
interface AdminStats {
  /** 文章总数 */
  totalPosts: number
  /** 评论总数 */
  totalComments: number
  /** 待审核评论数 */
  pendingComments: number
  /** 总浏览量 */
  totalViews: number
  /** 用户总数 */
  totalUsers: number
  /** 最近文章列表 */
  recentPosts: ApiPost[]
  /** 热门文章排行 */
  popularPosts: PopularPost[]
}

/** useAdminStats 返回值结构 */
interface UseAdminStatsReturn {
  /** 统计数据 */
  stats: AdminStats | null
  /** 是否加载中 */
  isLoading: boolean
  /** 错误信息 */
  error: string | null
  /** 重新获取数据 */
  refetch: () => void
}

/**
 * 获取后台统计数据
 * 调用 GET /api/admin/stats，包含文章数、评论数、浏览量等
 */
export function useAdminStats(): UseAdminStatsReturn {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await api.get<AdminStats>("/admin/stats")
      setStats(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取统计数据失败")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  return { stats, isLoading, error, refetch: fetchStats }
}

/* ========== 浏览量趋势 Hook ========== */

/** 每日浏览量数据点 */
interface DailyView {
  /** 日期，格式 YYYY-MM-DD */
  date: string
  /** 浏览次数 */
  count: number
}

/** 月度浏览量数据点 */
interface MonthlyView {
  /** 月份，格式 YYYY-MM */
  month: string
  /** 浏览次数 */
  count: number
}

/** 浏览量趋势数据结构，对应 GET /api/admin/stats/views 返回值 */
interface ViewTrends {
  /** 最近 30 天每日浏览量 */
  daily: DailyView[]
  /** 最近 12 月月度浏览量 */
  monthly: MonthlyView[]
}

/** useViewTrends 返回值结构 */
interface UseViewTrendsReturn {
  /** 趋势数据 */
  data: ViewTrends | null
  /** 是否加载中 */
  isLoading: boolean
  /** 错误信息 */
  error: string | null
  /** 重新获取数据 */
  refetch: () => void
}

/**
 * 获取浏览量趋势数据
 * 调用 GET /api/admin/stats/views，包含每日和月度浏览量
 */
export function useViewTrends(): UseViewTrendsReturn {
  const [data, setData] = useState<ViewTrends | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchViews = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const result = await api.get<ViewTrends>("/admin/stats/views")
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取浏览量数据失败")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchViews()
  }, [fetchViews])

  return { data, isLoading, error, refetch: fetchViews }
}

/** 导出浏览量相关类型供页面使用 */
export type { PopularPost, DailyView, MonthlyView, ViewTrends }

/* ========== 文章管理 Hook ========== */

/** useAdminPosts 返回值结构 */
interface UseAdminPostsReturn {
  /** 文章列表 */
  posts: ApiPost[]
  /** 总数量 */
  total: number
  /** 总页数 */
  totalPages: number
  /** 是否加载中 */
  isLoading: boolean
  /** 错误信息 */
  error: string | null
  /** 切换文章发布状态 */
  toggleStatus: (id: number) => Promise<void>
  /** 删除文章 */
  deletePost: (id: number) => Promise<void>
  /** 重新获取列表 */
  refetch: () => void
}

/**
 * 获取后台文章列表
 * @param params - 查询参数（页码、每页数量、状态筛选）
 */
export function useAdminPosts(params: PostListParams = {}): UseAdminPostsReturn {
  const [posts, setPosts] = useState<ApiPost[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { page = 1, limit = 10, status } = params

  const fetchPosts = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const queryParams = new URLSearchParams()
      queryParams.set("page", String(page))
      queryParams.set("limit", String(limit))
      if (status) {
        queryParams.set("status", status)
      }

      const data = await api.get<PaginatedResponse<ApiPost>>(
        `/posts?${queryParams.toString()}`,
      )

      setPosts(data.items)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取文章列表失败")
    } finally {
      setIsLoading(false)
    }
  }, [page, limit, status])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  /**
   * 切换文章发布状态（发布 <-> 草稿）
   * @param id - 文章 ID
   */
  const toggleStatus = useCallback(
    async (id: number) => {
      const post = posts.find((p) => p.id === id)
      if (!post) return

      const newStatus: PostStatus = post.status === "published" ? "draft" : "published"
      await api.patch(`/posts/${id}/status`, { status: newStatus })

      /* 更新本地状态，避免重新请求列表 */
      setPosts((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                status: newStatus,
                publishedAt: newStatus === "published" ? new Date().toISOString() : null,
              }
            : p,
        ),
      )
    },
    [posts],
  )

  /**
   * 删除文章
   * @param id - 文章 ID
   */
  const deletePost = useCallback(async (id: number) => {
    await api.del(`/posts/${id}`)
    /* 删除后更新本地列表 */
    setPosts((prev) => prev.filter((p) => p.id !== id))
    setTotal((prev) => prev - 1)
  }, [])

  return {
    posts,
    total,
    totalPages,
    isLoading,
    error,
    toggleStatus,
    deletePost,
    refetch: fetchPosts,
  }
}

/* ========== 评论管理 Hook ========== */

/** useAdminComments 返回值结构 */
interface UseAdminCommentsReturn {
  /** 待审核评论列表 */
  comments: ApiComment[]
  /** 是否加载中 */
  isLoading: boolean
  /** 错误信息 */
  error: string | null
  /** 重新获取列表 */
  refetch: () => void
}

/**
 * 获取待审核评论列表
 */
export function useAdminComments(): UseAdminCommentsReturn {
  const [comments, setComments] = useState<ApiComment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchComments = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await api.get<ApiComment[]>("/admin/comments/pending")
      setComments(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取评论列表失败")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  return { comments, isLoading, error, refetch: fetchComments }
}

/** useAdminCommentActions 返回值结构 */
interface UseAdminCommentActionsReturn {
  /** 批准评论 */
  approve: (id: number) => Promise<void>
  /** 标记为垃圾评论 */
  markSpam: (id: number) => Promise<void>
  /** 删除评论 */
  deleteComment: (id: number) => Promise<void>
}

/**
 * 评论操作 Hook
 * 提供批准、标记垃圾、删除功能
 */
export function useAdminCommentActions(): UseAdminCommentActionsReturn {
  /**
   * 批准评论
   * @param id - 评论 ID
   */
  const approve = useCallback(async (id: number) => {
    await api.patch(`/comments/${id}/status`, { status: "approved" })
  }, [])

  /**
   * 标记为垃圾评论
   * @param id - 评论 ID
   */
  const markSpam = useCallback(async (id: number) => {
    await api.patch(`/comments/${id}/status`, { status: "spam" })
  }, [])

  /**
   * 删除评论
   * @param id - 评论 ID
   */
  const deleteComment = useCallback(async (id: number) => {
    await api.del(`/comments/${id}`)
  }, [])

  return { approve, markSpam, deleteComment }
}

/* ========== 标签 Hook ========== */

/** useTags 返回值结构 */
interface UseTagsReturn {
  /** 标签列表 */
  tags: ApiTag[]
  /** 是否加载中 */
  isLoading: boolean
  /** 错误信息 */
  error: string | null
  /** 重新获取 */
  refetch: () => void
}

/**
 * 获取全部标签列表
 */
export function useTags(): UseTagsReturn {
  const [tags, setTags] = useState<ApiTag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTags = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await api.get<ApiTag[]>("/tags")
      setTags(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取标签列表失败")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTags()
  }, [fetchTags])

  return { tags, isLoading, error, refetch: fetchTags }
}

/* ========== 文章保存 Hook ========== */

/** useSavePost 返回值结构 */
interface UseSavePostReturn {
  /** 保存文章（新建或更新） */
  savePost: (data: PostFormData, id?: number) => Promise<ApiPost>
  /** 是否保存中 */
  isSaving: boolean
  /** 错误信息 */
  error: string | null
}

/**
 * 文章保存 Hook
 * 新建时传 id 为 undefined，编辑时传文章 id
 */
export function useSavePost(): UseSavePostReturn {
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * 保存文章
   * @param data - 文章表单数据
   * @param id - 文章 ID（编辑模式下传入）
   */
  const savePost = useCallback(async (data: PostFormData, id?: number): Promise<ApiPost> => {
    try {
      setIsSaving(true)
      setError(null)

      if (id) {
        /* 编辑模式：调用 PUT 更新 */
        return await api.put<ApiPost>(`/posts/${id}`, data)
      } else {
        /* 新建模式：调用 POST 创建 */
        return await api.post<ApiPost>("/posts", data)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "保存文章失败"
      setError(message)
      throw err
    } finally {
      setIsSaving(false)
    }
  }, [])

  return { savePost, isSaving, error }
}

/** 导出类型供页面使用 */
export type {
  ApiPost,
  ApiTag,
  ApiComment,
  PostFormData,
  PostListParams,
  PaginatedResponse,
  PostStatus,
}
