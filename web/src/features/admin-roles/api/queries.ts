import { apiGet } from "@shared/api/request";
import { useQuery } from "@tanstack/react-query";
import type { Permission, Role, RoleWithPermissions } from "../model/types";
import { roleKeys } from "./keys";

/**
 * fetchRoles - 调后端 GET /admin/roles 拉取角色列表
 *
 * 需管理员身份，httpClient 自动携带 cookie。后端返回含 user_count 的完整列表，
 * 不分页，一次返回全部角色。
 *
 * @returns 角色列表，含每角色用户数
 */
export const fetchRoles = async (): Promise<Role[]> =>
	apiGet<Role[]>("/admin/roles");

/**
 * useRoles - 角色列表 hook
 */
export const useRoles = () =>
	useQuery({
		queryKey: roleKeys.list(),
		queryFn: fetchRoles,
	});

/**
 * fetchRole - 调后端 GET /admin/roles/{id} 拉取角色详情含权限点
 *
 * @param id 角色 ID
 * @returns 角色详情，permissions 为权限点完整定义数组
 */
export const fetchRole = async (id: number): Promise<RoleWithPermissions> =>
	apiGet<RoleWithPermissions>(`/admin/roles/${id}`);

/**
 * useRole - 角色详情 hook
 *
 * @param id 角色 ID，传 undefined 时跳过查询
 */
export const useRole = (id: number | undefined) =>
	useQuery({
		queryKey: roleKeys.detail(id ?? 0),
		queryFn: () => {
			if (id === undefined) {
				throw new Error("角色 ID 不能为空");
			}
			return fetchRole(id);
		},
		enabled: id !== undefined,
	});

/**
 * fetchPermissions - 调后端 GET /admin/permissions 拉取所有权限点
 *
 * @returns 权限点列表，一次返回全部
 */
export const fetchPermissions = async (): Promise<Permission[]> =>
	apiGet<Permission[]>("/admin/permissions");

/**
 * usePermissions - 权限点列表 hook
 */
export const usePermissions = () =>
	useQuery({
		queryKey: roleKeys.permissions(),
		queryFn: fetchPermissions,
	});
