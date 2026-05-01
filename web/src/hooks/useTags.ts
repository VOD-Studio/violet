// 标签数据 Hook
// 使用 react-query 获取所有标签列表

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

/** 标签数据结构 */
interface Tag {
  id: string;
  name: string;
  slug: string;
}

/**
 * 获取所有标签
 */
export function useTags() {
  return useQuery({
    queryKey: ["tags"],
    queryFn: () => api.get<Tag[]>("/tags"),
    /** 标签数据变化不频繁，缓存更长时间 */
    staleTime: 10 * 60 * 1000,
  });
}

export type { Tag };
