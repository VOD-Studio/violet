// 后台管理数据 Hook
// 使用 react-query 管理仪表盘统计、文章管理、评论管理等数据

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"

/* ========== 类型定义 ========== */

/** 文章状态类型 */
type PostStatus = "draft" | "published"

/** 后端返回的文章结构 */
interface ApiPost {
  id: number
  title: string
  slug: string
  excerpt?: string
  content?: string
  status: PostStatus
  views: number
  coverImage?: string
  seoDescription?: string
  seoKeywords?: string
  tags?: ApiTag[]
  createdAt: string
  updatedAt: string
  publishedAt?: string | null
}

/** 标签结构 */
interface ApiTag {
  id: number
  name: string
  slug: string
}

/** 评论结构 */
interface ApiComment {
  id: number
  authorName: string
  content: string
  status: "pending" | "approved" | "spam"
  post?: {
    id: number
    title: string
    slug: string
  }
  createdAt: string
}

/** 文章列表查询参数 */
interface PostListParams {
  page?: number
  limit?: number
  status?: PostStatus
}

/** 分页响应结构 */
interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

/** 创建/更新文章的请求体 */
interface PostFormData {
  title: string
  content: string
  excerpt?: string
  status?: PostStatus
  tagIds?: number[]
  coverImage?: string
  seoDescription?: string
  seoKeywords?: string
}

/* ========== 仪表盘统计 ========== */

/** 热门文章结构 */
interface PopularPost {
  id: number
  title: string
  slug: string
  views: number
}

/** 仪表盘统计数据结构 */
interface AdminStats {
  totalPosts: number
  totalComments: number
  pendingComments: number
  totalViews: number
  totalUsers: number
  recentPosts: ApiPost[]
  popularPosts: PopularPost[]
}

/**
 * 获取后台统计数据
 */
export function useAdminStats() {
  return useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => api.get<AdminStats>("/admin/stats"),
  })
}

/* ========== 浏览量趋势 ========== */

/** 每日浏览量数据点 */
interface DailyView {
  date: string
  count: number
}

/** 月度浏览量数据点 */
interface MonthlyView {
  month: string
  count: number
}

/** 浏览量趋势数据结构 */
interface ViewTrends {
  daily: DailyView[]
  monthly: MonthlyView[]
}

/**
 * 获取浏览量趋势数据
 */
export function useViewTrends() {
  return useQuery({
    queryKey: ["admin", "views"],
    queryFn: () => api.get<ViewTrends>("/admin/stats/views"),
  })
}

/* ========== 文章管理 ========== */

/**
 * 获取后台文章列表
 */
export function useAdminPosts(params: PostListParams = {}) {
  const { page = 1, limit = 10, status } = params

  return useQuery({
    queryKey: ["admin", "posts", { page, limit, status }],
    queryFn: () => {
      const queryParams = new URLSearchParams()
      queryParams.set("page", String(page))
      queryParams.set("limit", String(limit))
      if (status) queryParams.set("status", status)
      return api.get<PaginatedResponse<ApiPost>>(`/posts?${queryParams.toString()}`)
    },
  })
}

/**
 * 切换文章发布状态的 mutation
 */
export function useTogglePostStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: PostStatus }) =>
      api.patch(`/posts/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "posts"] })
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] })
    },
  })
}

/**
 * 删除文章的 mutation
 */
export function useDeleteAdminPost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => api.del(`/posts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "posts"] })
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] })
    },
  })
}

/* ========== 评论管理 ========== */

/**
 * 获取待审核评论列表
 */
export function useAdminComments() {
  return useQuery({
    queryKey: ["admin", "comments", "pending"],
    queryFn: () => api.get<ApiComment[]>("/admin/comments/pending"),
  })
}

/**
 * 评论操作 mutation hook
 */
export function useAdminCommentActions() {
  const queryClient = useQueryClient()

  const approve = useMutation({
    mutationFn: (id: number) =>
      api.patch(`/comments/${id}/status`, { status: "approved" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "comments"] })
    },
  })

  const markSpam = useMutation({
    mutationFn: (id: number) =>
      api.patch(`/comments/${id}/status`, { status: "spam" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "comments"] })
    },
  })

  const deleteComment = useMutation({
    mutationFn: (id: number) => api.del(`/comments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "comments"] })
    },
  })

  return { approve, markSpam, deleteComment }
}

/* ========== 标签管理 ========== */

/**
 * 获取全部标签列表（后台管理用）
 */
export function useAdminTags() {
  return useQuery({
    queryKey: ["admin", "tags"],
    queryFn: () => api.get<ApiTag[]>("/tags"),
    staleTime: 5 * 60 * 1000,
  })
}

/* ========== 文章保存 ========== */

/**
 * 文章保存 mutation hook
 */
export function useSavePost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ data, id }: { data: PostFormData; id?: number }) => {
      if (id) {
        return api.put<ApiPost>(`/posts/${id}`, data)
      }
      return api.post<ApiPost>("/posts", data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "posts"] })
      queryClient.invalidateQueries({ queryKey: ["posts"] })
    },
  })
}

/* ========== 用户管理 ========== */

/** 用户数据结构 */
interface AdminUser {
  id: number
  username: string
  email: string
  role: string
  status: string
  createdAt: string
}

/**
 * 获取用户列表
 */
export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => api.get<AdminUser[]>("/admin/users"),
    placeholderData: [],
  })
}

/**
 * 修改用户角色的 mutation
 */
export function useUpdateUserRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, role }: { id: number; role: string }) =>
      api.patch(`/admin/users/${id}/role`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
    },
  })
}

/**
 * 切换用户状态的 mutation
 */
export function useToggleUserStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.patch(`/admin/users/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
    },
  })
}

/* ========== 媒体管理 ========== */

/** 媒体文件数据结构 */
interface MediaItem {
  id: number
  name: string
  url: string
  thumbnail: string
  size: number
  mimeType: string
  createdAt: string
}

/**
 * 获取媒体文件列表
 */
export function useAdminMedia() {
  return useQuery({
    queryKey: ["admin", "media"],
    queryFn: () => api.get<MediaItem[]>("/images"),
    placeholderData: [],
  })
}

/**
 * 删除媒体文件的 mutation
 */
export function useDeleteMedia() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => api.del(`/images/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "media"] })
    },
  })
}

/* ========== 站点设置 ========== */

/** 站点设置数据结构 */
interface SiteSettings {
  siteName: string
  siteDescription: string
  siteLogo: string
  commentPolicy: string
  allowAnonymous: boolean
  seoTitleSuffix: string
  seoDefaultDescription: string
  seoDefaultKeywords: string
}

/**
 * 获取站点设置
 */
export function useSiteSettings() {
  return useQuery({
    queryKey: ["admin", "settings"],
    queryFn: () => api.get<SiteSettings>("/admin/settings"),
  })
}

/**
 * 保存站点设置的 mutation
 */
export function useSaveSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Partial<SiteSettings>) =>
      api.put("/admin/settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "settings"] })
    },
  })
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
  PopularPost,
  DailyView,
  MonthlyView,
  ViewTrends,
  AdminStats,
  AdminUser,
  MediaItem,
  SiteSettings,
}
