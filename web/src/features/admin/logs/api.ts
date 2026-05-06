// 操作日志 API Hooks

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { logKeys } from "./queryKeys";
import type { AuditLogListResponse } from "./types";

/**
 * 获取操作日志列表
 */
export function useAuditLogs(page = 0, limit = 20) {
  return useQuery({
    queryKey: logKeys.list(),
    queryFn: async () => {
      const res = await api.get<AuditLogListResponse>(
        `/admin/logs?page=${page}&limit=${limit}`
      );
      return res;
    },
  });
}

/**
 * 获取指定用户的操作日志
 */
export function useAuditLogsByUser(userId: string, page = 0, limit = 20) {
  return useQuery({
    queryKey: logKeys.byUser(userId),
    queryFn: async () => {
      const res = await api.get<AuditLogListResponse>(
        `/admin/logs/user/${userId}?page=${page}&limit=${limit}`
      );
      return res;
    },
    enabled: userId !== "",
  });
}