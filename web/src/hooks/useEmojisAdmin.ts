// 表情管理端 Hook
// 使用 react-query 管理表情分组和表情的 CRUD 操作

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api, getUploadUrl } from "@/lib/api"

/* ========== 类型定义 ========== */

/** 表情分组结构（管理端，含未启用） */
export interface EmojiGroupAdmin {
  id: number
  name: string
  source: string
  sort_order: number
  is_enabled: boolean
  created_at: string
}

/** 单个表情结构 */
export interface EmojiAdmin {
  id: number
  groupId: number
  name: string
  url?: string
  textContent?: string
  sortOrder: number
  createdAt: string
}

/** 创建表情分组的请求体 */
export interface CreateEmojiGroupInput {
  name: string
  source?: string
  sortOrder?: number
  isEnabled?: boolean
}

/** 更新表情分组的请求体 */
export interface UpdateEmojiGroupInput {
  name?: string
  source?: string
  sort_order?: number
  is_enabled?: boolean
}

/** 创建表情的请求体 */
export interface CreateEmojiInput {
  name: string
  url?: string
  textContent?: string
  sortOrder?: number
}

/** 更新表情的请求体 */
export interface UpdateEmojiInput {
  name?: string
  url?: string
  textContent?: string
  sortOrder?: number
}

/** 分页响应结构 */
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/** 批量删除表情的请求体 */
export interface BatchDeleteEmojisInput {
  ids: number[]
}

/* ========== 表情分组管理 ========== */

/**
 * 获取所有表情分组（含未启用）
 */
export function useEmojiGroups() {
  return useQuery({
    queryKey: ["admin", "emojis", "groups"],
    queryFn: async () => {
      const res = await api.get<{ groups: EmojiGroupAdmin[] }>(
        "/admin/emojis/groups",
      )
      return res.groups ?? []
    },
    placeholderData: [],
  })
}

/**
 * 创建表情分组
 */
export function useCreateEmojiGroup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateEmojiGroupInput) => {
      return api.post<EmojiGroupAdmin>("/admin/emojis/groups", {
        name: data.name,
        source: data.source || "custom",
        sort_order: data.sortOrder || 0,
        is_enabled: data.isEnabled ?? true,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "emojis", "groups"] })
    },
  })
}

/**
 * 更新表情分组
 */
export function useUpdateEmojiGroup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number
      data: UpdateEmojiGroupInput
    }) => {
      const payload: Record<string, unknown> = {}
      if (data.name !== undefined) payload.name = data.name
      if (data.source !== undefined) payload.source = data.source
      if (data.sort_order !== undefined) payload.sort_order = data.sort_order
      if (data.is_enabled !== undefined) payload.is_enabled = data.is_enabled
      return api.patch(`/admin/emojis/groups/${id}`, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "emojis", "groups"] })
    },
  })
}

/**
 * 删除表情分组
 */
export function useDeleteEmojiGroup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => api.del(`/admin/emojis/groups/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "emojis", "groups"] })
    },
  })
}

/* ========== 表情管理 ========== */

/**
 * 获取分组内所有表情
 */
export function useEmojisByGroup(groupId: number) {
  return useQuery({
    queryKey: ["admin", "emojis", groupId],
    queryFn: async () => {
      const res = await api.get<{ emojis: EmojiAdmin[] }>(
        `/admin/emojis/groups/${groupId}/emojis`,
      )
      return res.emojis ?? []
    },
    enabled: groupId > 0,
    placeholderData: [],
  })
}

/**
 * 分页获取分组内表情
 */
export function useEmojisByGroupPaginated(
  groupId: number,
  page: number = 1,
  pageSize: number = 20,
) {
  return useQuery({
    queryKey: ["admin", "emojis", groupId, "paginated", page, pageSize],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<EmojiAdmin>>(
        `/admin/emojis/groups/${groupId}/emojis/paginated`,
        { page, pageSize },
      )
      return res
    },
    enabled: groupId > 0,
  })
}

/**
 * 获取分组内表情总数
 */
export function useEmojiCount(groupId: number) {
  return useQuery({
    queryKey: ["admin", "emojis", groupId, "count"],
    queryFn: async () => {
      const res = await api.get<{ total: number }>(
        `/admin/emojis/groups/${groupId}/emojis/count`,
      )
      return res.total ?? 0
    },
    enabled: groupId > 0,
  })
}

/**
 * 创建表情
 */
export function useCreateEmoji() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      groupId,
      data,
    }: {
      groupId: number
      data: CreateEmojiInput
    }) => {
      return api.post<EmojiAdmin>(`/admin/emojis/groups/${groupId}/emojis`, {
        name: data.name,
        url: data.url || "",
        text_content: data.textContent || "",
        sort_order: data.sortOrder || 0,
      })
    },
    onSuccess: (_, { groupId }) => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "emojis", groupId],
      })
      queryClient.invalidateQueries({ queryKey: ["admin", "emojis", "groups"] })
    },
  })
}

/**
 * 更新表情
 */
export function useUpdateEmoji() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number
      data: UpdateEmojiInput
    }) => {
      const payload: Record<string, unknown> = {}
      if (data.name !== undefined) payload.name = data.name
      if (data.url !== undefined) payload.url = data.url
      if (data.textContent !== undefined) payload.text_content = data.textContent
      if (data.sortOrder !== undefined) payload.sort_order = data.sortOrder
      return api.patch<EmojiAdmin>(`/admin/emojis/${id}`, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "emojis"] })
    },
  })
}

/**
 * 删除表情
 */
export function useDeleteEmoji() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => api.del(`/admin/emojis/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "emojis"] })
      queryClient.invalidateQueries({ queryKey: ["admin", "emoji-groups"] })
    },
  })
}

/**
 * 批量更新分组状态
 */
export function useBatchUpdateGroupsStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ ids, is_enabled }: { ids: number[]; is_enabled: boolean }) =>
      api.patch<{ updated: number }>("/admin/emojis/groups/batch-status", {
        ids,
        is_enabled,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "emojis", "groups"] })
    },
  })
}

/* ========== 辅助函数 ========== */

/**
 * 获取表情显示内容
 * 根据表情类型返回图片 URL 或文本内容
 */
export function getEmojiDisplay(emoji: EmojiAdmin): string {
  if (emoji.url) {
    return getUploadUrl(emoji.url)
  }
  return emoji.textContent || emoji.name
}