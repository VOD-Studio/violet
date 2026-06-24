import { apiGet, apiGetPaged } from "@shared/api/request";
import type { PagedResponse } from "@shared/api/types";
import { useQuery } from "@tanstack/react-query";
import type { AdminUser, UserDetail, UserListQuery } from "../model/types";
import { adminUserKeys } from "./keys";

/**
 * fetchAdminUsers - 调后端 GET /admin/users 拉取用户列表
 *
 * 需管理员身份，httpClient 自动携带 cookie。支持 role/is_active/keyword 筛选
 * 与 page/limit 分页，query 参数直接透传给后端 ListUsers handler。
 *
 * @param query 分页与筛选参数
 * @returns 解包后的用户列表与分页元数据
 */
export const fetchAdminUsers = async (
	query: UserListQuery = {},
): Promise<PagedResponse<AdminUser>> => apiGetPaged<AdminUser>("/admin/users", { params: query });

/**
 * useAdminUsers - 用户列表 hook
 *
 * 缓存 key 由查询参数决定，切换筛选或页码自动重新请求。
 *
 * @param query 分页与筛选参数
 */
export const useAdminUsers = (query: UserListQuery = {}) =>
	useQuery({
		queryKey: adminUserKeys.list(query),
		queryFn: () => fetchAdminUsers(query),
	});

/**
 * fetchAdminUserDetail - 调后端 GET /admin/users/{id} 拉取用户详情
 *
 * 需管理员身份。返回字段集与列表一致。
 *
 * @param id 用户 ID
 * @returns 解包后的用户详情
 */
export const fetchAdminUserDetail = async (id: string): Promise<UserDetail> =>
	apiGet<UserDetail>(`/admin/users/${id}`);

/**
 * useAdminUserDetail - 用户详情 hook
 *
 * @param id 用户 ID，传空字符串时禁用查询避免无效请求
 */
export const useAdminUserDetail = (id: string) =>
	useQuery({
		queryKey: adminUserKeys.detail(id),
		queryFn: () => fetchAdminUserDetail(id),
		enabled: !!id,
	});
