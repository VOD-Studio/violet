// 站点设置 Hooks
// 使用 react-query 管理站点设置相关的 API 调用

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

/* ========== 类型定义 ========== */

/** 站点设置数据结构 */
export interface SiteSettings {
  /** 站点名称 */
  site_name: string;
  /** 站点描述 */
  site_description: string;
  /** 站点 URL */
  site_url: string;
  /** 管理员邮箱 */
  admin_email: string;
  /** 每页文章数 */
  posts_per_page: number;
  /** 是否启用评论 */
  comments_enabled: boolean;
  /** 评论是否需要审核 */
  comments_moderation: boolean;
  /** GitHub 用户名 */
  github_username: string;
  /** 页脚文本 */
  footer_text: string;
}

/** 公开站点设置（不需要认证） */
export interface PublicSettings {
  /** 站点名称 */
  site_name: string;
  /** 站点描述 */
  site_description: string;
  /** GitHub 用户名 */
  github_username: string;
  /** 页脚文本 */
  footer_text: string;
}

/* ========== Hooks ========== */

/**
 * 获取站点设置
 */
export function useSiteSettings() {
  return useQuery({
    queryKey: ["admin", "settings"],
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
      queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
    },
  });
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
  });
}
