// 标签管理 API Hooks
// 使用 react-query 管理标签相关的 API 调用

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { tagKeys } from "./queryKeys";
import type { ApiTag } from "./types";

/**
 * 获取全部标签列表（后台管理用）
 * API 返回 { tags: [...] } 格式，需要提取 tags 数组
 */
export function useAdminTags() {
  return useQuery({
    queryKey: tagKeys.list(),
    queryFn: async () => {
      const res = await api.get<{ tags: ApiTag[] }>("/tags");
      return res.tags ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}
