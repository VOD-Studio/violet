/**
 * 站点设置 API Hook
 * 获取公开站点设置，无需认证
 */

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { SiteSettings } from "./types";

/**
 * 获取公开站点设置
 */
export function usePublicSettings() {
  return useQuery<SiteSettings>({
    queryKey: ["settings", "public"],
    queryFn: () => api.get<SiteSettings>("/settings"),
    staleTime: 5 * 60 * 1000, // 5 分钟内认为数据新鲜
  });
}