// 用户管理 API Hooks
// 使用 react-query 管理用户相关的 API 调用

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { userKeys } from "./queryKeys";
import type { AdminUser } from "./types";

/**
 * 获取用户列表
 * API 返回 { users: [...], total, page, limit } 格式
 */
export function useAdminUsers() {
  return useQuery({
    queryKey: userKeys.list(),
    queryFn: async () => {
      const res = await api.get<{ users: AdminUser[] }>("/admin/users");
      return res.users ?? [];
    },
    placeholderData: [],
  });
}

/**
 * 修改用户角色的 mutation
 */
export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      api.patch(`/admin/users/${id}/role`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
}

/**
 * 切换用户状态的 mutation
 */
export function useToggleUserStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.patch(`/admin/users/${id}/status`, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
}
