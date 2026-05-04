// 标签管理 Hooks
// 使用 react-query 管理标签相关的 API 调用

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ApiTag } from "./useAdminPosts";

/* ========== Hooks ========== */

/**
 * 获取全部标签列表（后台管理用）
 * API 返回 { tags: [...] } 格式，需要提取 tags 数组
 */
export function useAdminTags() {
  return useQuery({
    queryKey: ["admin", "tags"],
    queryFn: async () => {
      const res = await api.get<{ tags: ApiTag[] }>("/tags");
      return res.tags ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// 导出类型供其他模块使用
export type { ApiTag };
