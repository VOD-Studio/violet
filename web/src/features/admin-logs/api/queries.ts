import { apiGetPaged } from "@shared/api/request";
import type { PagedResponse } from "@shared/api/types";
import { useQuery } from "@tanstack/react-query";
import type { AuditLog, LogListQuery } from "../model/types";
import { auditLogKeys } from "./keys";

/**
 * fetchAuditLogs - 调后端 GET /admin/logs 拉取操作日志列表
 *
 * 需管理员身份，httpClient 自动携带 cookie。仅支持 page/limit 分页，
 * 不支持 action/resource/user_id 等筛选，筛选需前端侧自行过滤。
 *
 * @param query 分页参数
 * @returns 解包后的日志列表与分页元数据
 */
export const fetchAuditLogs = async (
	query: LogListQuery = {},
): Promise<PagedResponse<AuditLog>> => {
	const { page, limit } = query;
	return apiGetPaged<AuditLog>("/admin/logs", {
		params: { page, limit },
	});
};

/**
 * useAuditLogs - 操作日志列表 hook
 *
 * 缓存 key 由分页参数决定，切换页码自动重新请求。
 *
 * @param query 分页参数
 */
export const useAuditLogs = (query: LogListQuery = {}) =>
	useQuery({
		queryKey: auditLogKeys.list(query),
		queryFn: () => fetchAuditLogs(query),
	});

/**
 * fetchAuditLogsByUser - 调后端 GET /admin/logs/user/{id} 拉取指定用户操作日志
 *
 * 需管理员身份。返回该用户的所有操作记录，按时间倒序。
 *
 * @param userId 用户 ID
 * @param query 分页参数
 * @returns 解包后的日志列表与分页元数据
 */
export const fetchAuditLogsByUser = async (
	userId: string,
	query: LogListQuery = {},
): Promise<PagedResponse<AuditLog>> => {
	const { page, limit } = query;
	return apiGetPaged<AuditLog>(`/admin/logs/user/${userId}`, {
		params: { page, limit },
	});
};

/**
 * useAuditLogsByUser - 指定用户的操作日志 hook
 *
 * @param userId 用户 ID
 * @param query 分页参数
 */
export const useAuditLogsByUser = (userId: string, query: LogListQuery = {}) =>
	useQuery({
		queryKey: auditLogKeys.user(userId, query),
		queryFn: () => fetchAuditLogsByUser(userId, query),
	});
