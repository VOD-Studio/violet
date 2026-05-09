// 用户管理 API Hooks
// 使用 react-query 管理用户相关的 API 调用

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { userKeys } from "./queryKeys";
import type {
  CreateUserRequest,
  UpdateUserRequest,
  UserListParams,
  UserListResponse,
} from "./types";

/**
 * 获取用户列表（支持搜索和筛选）
 * API 返回 UserListResponse 格式
 */
export function useAdminUsers(params: UserListParams = {}) {
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: async (): Promise<UserListResponse> => {
      const queryParams = new URLSearchParams();
      if (params.search) queryParams.set("search", params.search);
      if (params.role) queryParams.set("role", params.role);
      if (params.status) queryParams.set("status", params.status);
      if (params.page) queryParams.set("page", String(params.page));
      if (params.limit) queryParams.set("limit", String(params.limit));

      const queryString = queryParams.toString();
      const url = queryString ? `/admin/users?${queryString}` : "/admin/users";

      const res = await api.get<UserListResponse>(url);
      return res;
    },
    placeholderData: { users: [], total: 0, page: 1, limit: 20 },
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

/**
 * 批量更新用户状态的 mutation
 */
export function useBatchUpdateUserStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      user_ids,
      is_active,
    }: {
      user_ids: string[];
      is_active: boolean;
    }) => api.post(`/admin/users/batch-status`, { user_ids, is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
}

/**
 * 批量修改用户角色的 mutation
 */
export function useBatchUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ user_ids, role }: { user_ids: string[]; role: string }) =>
      api.post(`/admin/users/batch-role`, { user_ids, role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
}

/**
 * 创建用户的 mutation
 */
export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateUserRequest) => api.post("/admin/users", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
}

/**
 * 编辑用户的 mutation
 */
export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdateUserRequest) =>
      api.put(`/admin/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
}

/**
 * 删除用户的 mutation
 */
export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.del(`/admin/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
}
