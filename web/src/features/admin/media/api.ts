// 媒体管理 API Hooks
// 使用 react-query 管理媒体文件相关的 API 调用

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { mediaKeys } from "./queryKeys";
import type { MediaItem } from "./types";

/**
 * 获取媒体文件列表
 * API 返回 { media: [...], total, page, limit } 格式
 */
export function useAdminMedia() {
  return useQuery({
    queryKey: mediaKeys.list(),
    queryFn: async () => {
      const res = await api.get<{ media: MediaItem[] }>("/media");
      return res.media ?? [];
    },
    placeholderData: [],
  });
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
  const params: Record<string, unknown> = { page, limit };
  if (mimeType) params.type = mimeType;
  const res = await api.get<{
    media: MediaItem[];
    total: number;
    page: number;
    limit: number;
  }>("/media", params);
  return {
    items: res.media ?? [],
    total: res.total ?? 0,
    page: res.page ?? page,
    limit: res.limit ?? limit,
  };
}

/**
 * 删除媒体文件的 mutation
 */
export function useDeleteMedia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.del(`/media/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mediaKeys.all });
    },
  });
}

/**
 * 批量删除媒体文件的 mutation
 */
export function useBatchDeleteMedia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) =>
      api.post<{ message: string; count: number }>("/media/batch-delete", {
        ids,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mediaKeys.all });
    },
  });
}
