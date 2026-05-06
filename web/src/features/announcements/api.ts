/**
 * 公告功能 API 层
 * 使用 react-query 管理公告数据
 */

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AnnouncementsResponse } from "./types";

/**
 * 获取生效的公告列表
 */
export function useAnnouncements() {
  return useQuery({
    queryKey: ["announcements"],
    queryFn: () => api.get<AnnouncementsResponse>("/announcements"),
    staleTime: 5 * 60 * 1000, // 5 分钟内不重新请求
  });
}