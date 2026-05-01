// 表情包管理端 Hook
// 使用 react-query 管理表情包组的 CRUD 操作

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

/* ========== 类型定义 ========== */

/** 表情包组结构 */
export interface StickerGroup {
  /** 组唯一标识 */
  id: string;
  /** 组名称 */
  name: string;
  /** URL slug */
  slug: string;
  /** 图标 URL */
  icon?: string;
  /** 描述 */
  description?: string;
  /** 排序权重 */
  sort: number;
  /** 是否热门 */
  is_hot: boolean;
  /** 是否启用 */
  is_active: boolean;
  /** 组内表情包数量 */
  sticker_count?: number;
  /** 创建时间 */
  created_at: string;
  /** 更新时间 */
  updated_at: string;
}

/** 单个表情包结构 */
export interface Sticker {
  /** 表情包唯一标识 */
  id: string;
  /** 所属组 ID */
  group_id: string;
  /** 图片 URL */
  image_url: string;
  /** 排序权重 */
  sort: number;
  /** 是否启用 */
  is_active: boolean;
  /** 创建时间 */
  created_at: string;
}

/** 创建/更新表情包组的请求体 */
export interface StickerGroupFormData {
  /** 组名称 */
  name: string;
  /** URL slug */
  slug?: string;
  /** 图标 URL */
  icon?: string;
  /** 描述 */
  description?: string;
  /** 排序权重 */
  sort?: number;
  /** 是否热门 */
  is_hot?: boolean;
  /** 是否启用 */
  is_active?: boolean;
}

/** 更新表情包的请求体 */
export interface StickerFormData {
  /** 排序权重 */
  sort?: number;
  /** 是否启用 */
  is_active?: boolean;
}

/* ========== 表情包组管理 ========== */

/**
 * 获取所有表情包组
 */
export function useStickerGroups() {
  return useQuery({
    queryKey: ["admin", "sticker-groups"],
    queryFn: async () => {
      const res = await api.get<{ groups: StickerGroup[] }>(
        "/admin/sticker-groups"
      );
      return res.groups ?? [];
    },
    placeholderData: [],
  });
}

/**
 * 创建表情包组
 */
export function useCreateStickerGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: StickerGroupFormData) => {
      // 转换字段名匹配后端期望
      const payload = {
        name: data.name,
        slug:
          data.slug ||
          data.name
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^\w-]/g, ""),
        icon_url: data.icon,
        description: data.description,
        sort_order: data.sort,
        is_hot: data.is_hot,
        is_active: data.is_active,
      };
      return api.post<StickerGroup>("/admin/sticker-groups", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "sticker-groups"] });
    },
  });
}

/**
 * 更新表情包组
 */
export function useUpdateStickerGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<StickerGroupFormData>;
    }) => {
      const payload: Record<string, unknown> = {};
      if (data.name !== undefined) payload.name = data.name;
      if (data.slug !== undefined) payload.slug = data.slug;
      if (data.icon !== undefined) payload.icon_url = data.icon;
      if (data.description !== undefined)
        payload.description = data.description;
      if (data.sort !== undefined) payload.sort_order = data.sort;
      if (data.is_hot !== undefined) payload.is_hot = data.is_hot;
      if (data.is_active !== undefined) payload.is_active = data.is_active;
      return api.patch<StickerGroup>(`/admin/sticker-groups/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "sticker-groups"] });
    },
  });
}

/**
 * 删除表情包组
 */
export function useDeleteStickerGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.del(`/admin/sticker-groups/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "sticker-groups"] });
    },
  });
}

/**
 * 更新表情包组排序
 */
export function useUpdateStickerGroupsSort() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orders: { id: string; sort: number }[]) =>
      api.patch("/admin/sticker-groups/sort", { orders }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "sticker-groups"] });
    },
  });
}

/* ========== 表情包管理 ========== */

/**
 * 获取组内所有表情包
 */
export function useStickers(groupId: string) {
  return useQuery({
    queryKey: ["admin", "stickers", groupId],
    queryFn: async () => {
      const res = await api.get<{ stickers: Sticker[] }>(
        `/admin/sticker-groups/${groupId}/stickers`
      );
      return res.stickers ?? [];
    },
    enabled: !!groupId,
    placeholderData: [],
  });
}

/**
 * 创建表情包（上传图片）
 */
export function useCreateSticker() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ groupId, url }: { groupId: string; url: string }) => {
      // 自动生成name和slug（使用时间戳）
      const timestamp = Date.now();
      const name = `sticker-${timestamp}`;
      const slug = `sticker-${timestamp}`;
      return api.post<Sticker>(`/admin/sticker-groups/${groupId}/stickers`, {
        name,
        slug,
        image_url: url,
      });
    },
    onSuccess: (_, { groupId }) => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "stickers", groupId],
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "sticker-groups"] });
    },
  });
}

/**
 * 更新表情包
 */
export function useUpdateSticker() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<StickerFormData>;
    }) => api.patch<Sticker>(`/admin/stickers/${id}`, data),
    onSuccess: () => {
      // 获取所有 sticker queries 并刷新
      queryClient.invalidateQueries({ queryKey: ["admin", "stickers"] });
    },
  });
}

/**
 * 删除表情包
 */
export function useDeleteSticker() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.del(`/admin/stickers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "stickers"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "sticker-groups"] });
    },
  });
}

/**
 * 更新表情包排序
 */
export function useUpdateStickersSort() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      groupId,
      orders,
    }: {
      groupId: string;
      orders: { id: string; sort: number }[];
    }) =>
      api.patch(`/admin/sticker-groups/${groupId}/stickers/sort`, { orders }),
    onSuccess: (_, { groupId }) => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "stickers", groupId],
      });
    },
  });
}
