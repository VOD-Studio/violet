// 后台管理数据 Hook
// 使用 react-query 管理仪表盘统计、文章管理、评论管理等数据

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"

/* ========== 类型定义 ========== */

/** 文章状态类型 */
type PostStatus = "draft" | "published"

/** 后端返回的文章结构 */
interface ApiPost {
	/** 文章唯一标识 */
	id: number
	/** 文章标题 */
	title: string
	/** URL slug */
	slug: string
	/** 文章摘要 */
	excerpt?: string
	/** Markdown 正文内容 */
	contentMarkdown?: string
	/** 发布状态 */
	status: PostStatus
	/** 浏览次数 */
	viewCount: number
	/** 封面图片 */
	coverImage?: string
	/** SEO 描述 */
	seoDescription?: string
	/** SEO 关键词 */
	seoKeywords?: string
	/** 文章标签 */
	tags?: ApiTag[]
	/** 创建时间 */
	createdAt: string
	/** 更新时间 */
	updatedAt?: string
	/** 发布时间 */
	publishedAt?: string | null
}

/** 标签结构 */
interface ApiTag {
	/** 标签唯一标识 */
	id: number
	/** 标签名称 */
	name: string
	/** URL slug */
	slug: string
}

/** 评论结构 */
interface ApiComment {
	/** 评论唯一标识 */
	id: string
	/** 所属文章 ID */
	post_id: string
	/** 父评论 ID */
	parent_id?: string
	/** 评论者昵称 */
	author_name: string
	/** 评论者邮箱 */
	author_email?: string
	/** 评论者网站 */
	author_url?: string
	/** 评论者头像 */
	avatar_url?: string
	/** 评论内容 HTML */
	body_html: string
	/** 评论状态 */
	status: "pending" | "approved" | "spam"
	/** 创建时间 */
	created_at: string
	/** 子评论列表 */
	children?: ApiComment[]
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
	/** 数据项列表 */
	items: T[]
	/** 总数 */
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
	/** Markdown 正文内容 */
	contentMarkdown: string
	/** 文章摘要 */
	excerpt?: string
	/** 发布状态 */
	status?: PostStatus
	/** 标签 ID 列表 */
	tagIds?: number[]
	/** 封面图片 URL */
	coverImage?: string
	/** SEO 描述 */
	seoDescription?: string
	/** SEO 关键词 */
	seoKeywords?: string
}

/* ========== 仪表盘统计 ========== */

/** 热门文章结构 */
interface PopularPost {
	/** 文章唯一标识 */
	id: number
	/** 文章标题 */
	title: string
	/** URL slug */
	slug: string
	/** 浏览次数 */
	viewCount: number
}

/** 仪表盘统计数据结构 */
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
	/** 热门文章列表 */
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
	/** 日期 */
	date: string
	/** 浏览次数 */
	count: number
}

/** 月度浏览量数据点 */
interface MonthlyView {
	/** 月份 */
	month: string
	/** 浏览次数 */
	count: number
}

/** 浏览量趋势数据结构 */
interface ViewTrends {
	/** 每日数据 */
	daily: DailyView[]
	/** 月度数据 */
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

/** 文章列表响应结构 */
interface PostListResponse {
	/** 文章列表 */
	posts: ApiPost[]
	/** 总数 */
	total: number
	/** 当前页码 */
	page: number
	/** 每页数量 */
	limit: number
}

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
      return api.get<PostListResponse>(`/posts?${queryParams.toString()}`)
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
 * API 返回 { comments: [...], total, page, page_size } 格式
 */
export function useAdminComments() {
  return useQuery({
    queryKey: ["admin", "comments", "pending"],
    queryFn: async () => {
      const res = await api.get<{ comments: ApiComment[] }>("/admin/comments/pending")
      return res.comments ?? []
    },
  })
}

/**
 * 评论操作 mutation hook
 */
export function useAdminCommentActions() {
  const queryClient = useQueryClient()

  const approve = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/comments/${id}/status`, { status: "approved" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "comments"] })
    },
  })

  const markSpam = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/comments/${id}/status`, { status: "spam" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "comments"] })
    },
  })

  const deleteComment = useMutation({
    mutationFn: (id: string) => api.del(`/comments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "comments"] })
    },
  })

  return { approve, markSpam, deleteComment }
}

/* ========== 标签管理 ========== */

/**
 * 获取全部标签列表（后台管理用）
 * API 返回 { tags: [...] } 格式，需要提取 tags 数组
 */
export function useAdminTags() {
  return useQuery({
    queryKey: ["admin", "tags"],
    queryFn: async () => {
      const res = await api.get<{ tags: ApiTag[] }>("/tags")
      return res.tags ?? []
    },
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
  /** 用户唯一标识 */
  id: string
  /** 用户名 */
  username: string
  /** 邮箱 */
  email: string
  /** 角色：admin / user */
  role: string
  /** 是否启用 */
  is_active: boolean
  /** 邮箱是否已验证 */
  email_verified: boolean
  /** 注册时间 */
  created_at: string
}

/**
 * 获取用户列表
 * API 返回 { users: [...], total, page, limit } 格式
 */
export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const res = await api.get<{ users: AdminUser[] }>("/admin/users")
      return res.users ?? []
    },
    placeholderData: [],
  })
}

/**
 * 修改用户角色的 mutation
 */
export function useUpdateUserRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
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
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.patch(`/admin/users/${id}/status`, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
    },
  })
}

/* ========== 媒体管理 ========== */

/** 媒体文件数据结构 */
interface MediaItem {
  /** 媒体文件唯一标识 */
  id: string
  /** 存储文件名 */
  filename: string
  /** 原始文件名 */
  original_name: string
  /** MIME 类型 */
  mime_type: string
  /** 文件大小（字节） */
  size: number
  /** 文件路径 */
  path: string
  /** 图片宽度 */
  width?: number
  /** 图片高度 */
  height?: number
  /** 音视频时长 */
  duration?: number
  /** 下载次数 */
  download_count: number
  /** 下载权限 */
  download_permission: string
  /** 创建时间 */
  created_at: string
}

/**
 * 获取媒体文件列表
 * API 返回 { media: [...], total, page, limit } 格式
 */
export function useAdminMedia() {
  return useQuery({
    queryKey: ["admin", "media"],
    queryFn: async () => {
      const res = await api.get<{ media: MediaItem[] }>("/media")
      return res.media ?? []
    },
    placeholderData: [],
  })
}

/**
 * 分页获取媒体文件列表，支持按 MIME 类型筛选
 * 返回 { items, total, page, limit } 供 usePaginatedQuery 使用
 */
export async function fetchMediaPage(
  page: number,
  limit: number,
  mimeType?: string,
): Promise<{ items: MediaItem[]; total: number; page: number; limit: number }> {
  const params: Record<string, unknown> = { page, limit }
  if (mimeType) params.type = mimeType
  const res = await api.get<{
    media: MediaItem[]
    total: number
    page: number
    limit: number
  }>("/media", params)
  return {
    items: res.media ?? [],
    total: res.total ?? 0,
    page: res.page ?? page,
    limit: res.limit ?? limit,
  }
}

/**
 * 删除媒体文件的 mutation
 */
export function useDeleteMedia() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => api.del(`/media/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "media"] })
    },
  })
}

/* ========== 站点设置 ========== */

/** 站点设置数据结构 */
interface SiteSettings {
	/** 站点名称 */
	site_name: string
	/** 站点描述 */
	site_description: string
	/** 站点 URL */
	site_url: string
	/** 管理员邮箱 */
	admin_email: string
	/** 每页文章数 */
	posts_per_page: number
	/** 是否启用评论 */
	comments_enabled: boolean
	/** 评论是否需要审核 */
	comments_moderation: boolean
	/** GitHub 用户名 */
	github_username: string
	/** 页脚文本 */
	footer_text: string
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

/** 公开站点设置（不需要认证） */
interface PublicSettings {
	/** 站点名称 */
	site_name: string
	/** 站点描述 */
	site_description: string
	/** GitHub 用户名 */
	github_username: string
	/** 页脚文本 */
	footer_text: string
}

/**
 * 获取公开站点设置
 * 用于前台页面，不需要管理员认证
 */
export function usePublicSettings() {
  return useQuery({
    queryKey: ["settings", "public"],
    queryFn: () => api.get<PublicSettings>("/settings"),
    staleTime: 10 * 60 * 1000,
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
