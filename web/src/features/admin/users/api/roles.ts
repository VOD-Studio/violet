/**
 * 角色配置 API
 * 从后台获取角色列表
 */

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

/** 角色数据（从 API 返回） */
export interface RoleFromApi {
  id: number;
  name: string;
  description: string;
  created_at: string;
  user_count: number;
}

/** 角色配置（用于前端组件） */
export interface RoleConfig {
  value: string;
  label: string;
}

/** 角色列表响应 */
interface RoleListResponse {
  roles: RoleFromApi[];
}

/** Query Keys */
export const roleKeys = {
  all: ["admin", "roles"] as const,
  list: () => [...roleKeys.all, "list"] as const,
};

/**
 * 获取角色列表
 */
export function useRoles() {
  return useQuery({
    queryKey: roleKeys.list(),
    queryFn: async () => {
      const response = await api.get<RoleListResponse>("/admin/roles");
      return response.roles;
    },
    staleTime: 5 * 60 * 1000, // 5 分钟缓存
  });
}

/**
 * 将 API 角色转换为前端配置格式
 */
export function toRoleConfig(roles: RoleFromApi[]): RoleConfig[] {
  return roles.map((role) => ({
    value: role.name,
    label: role.description || role.name,
  }));
}

/**
 * 获取角色标签
 */
export function getRoleLabel(roleName: string, roles: RoleFromApi[]): string {
  const role = roles.find((r) => r.name === roleName);
  return role?.description || role?.name || roleName;
}
