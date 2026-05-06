// 角色管理 API Hooks
// 使用 react-query 管理角色相关的 API 调用

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { roleKeys } from "./queryKeys";
import type {
  Role,
  Permission,
  CreateRoleInput,
  UpdateRoleInput,
  UpdateRolePermissionsInput,
} from "./types";

/**
 * 获取角色列表
 */
export function useRoles() {
  return useQuery({
    queryKey: roleKeys.list(),
    queryFn: async () => {
      const res = await api.get<{ roles: Role[] }>("/admin/roles");
      return res.roles ?? [];
    },
    placeholderData: [],
  });
}

/**
 * 获取单个角色详情
 */
export function useRole(id: number) {
  return useQuery({
    queryKey: roleKeys.detail(id),
    queryFn: async () => {
      const res = await api.get<Role>(`/admin/roles/${id}`);
      return res;
    },
    enabled: id > 0,
  });
}

/**
 * 获取角色权限列表
 */
export function useRolePermissions(id: number) {
  return useQuery({
    queryKey: roleKeys.permissions(id),
    queryFn: async () => {
      const res = await api.get<{ permissions: Permission[] }>(
        `/admin/roles/${id}/permissions`
      );
      return res.permissions ?? [];
    },
    enabled: id > 0,
  });
}

/**
 * 获取所有权限列表
 */
export function usePermissions() {
  return useQuery({
    queryKey: roleKeys.allPermissions(),
    queryFn: async () => {
      const res = await api.get<{ permissions: Permission[] }>("/admin/permissions");
      return res.permissions ?? [];
    },
    placeholderData: [],
  });
}

/**
 * 创建角色
 */
export function useCreateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRoleInput) => api.post<Role>("/admin/roles", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roleKeys.list() });
    },
  });
}

/**
 * 更新角色
 */
export function useUpdateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateRoleInput }) =>
      api.patch<Role>(`/admin/roles/${id}`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: roleKeys.list() });
      queryClient.invalidateQueries({ queryKey: roleKeys.detail(variables.id) });
    },
  });
}

/**
 * 删除角色
 */
export function useDeleteRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.del(`/admin/roles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roleKeys.list() });
    },
  });
}

/**
 * 更新角色权限
 */
export function useUpdateRolePermissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: UpdateRolePermissionsInput;
    }) => api.patch(`/admin/roles/${id}/permissions`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: roleKeys.permissions(variables.id),
      });
    },
  });
}