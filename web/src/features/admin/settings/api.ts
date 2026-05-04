// 站点设置 API Hooks
// 使用 react-query 管理站点设置相关的 API 调用

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { settingsKeys } from "./queryKeys";
import type { SiteSettings, PublicSettings } from "./types";

/**
 * 获取站点设置
 */
export function useSiteSettings() {
  return useQuery({
    queryKey: settingsKeys.detail(),
    queryFn: () => api.get<SiteSettings>("/admin/settings"),
  });
}

/**
 * 保存站点设置的 mutation
 */
export function useSaveSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<SiteSettings>) =>
      api.put("/admin/settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all });
    },
  });
}

/**
 * 获取公开站点设置
 * 用于前台页面，不需要管理员认证
 */
export function usePublicSettings() {
  return useQuery({
    queryKey: settingsKeys.public,
    queryFn: () => api.get<PublicSettings>("/settings"),
    staleTime: 10 * 60 * 1000,
  });
}
