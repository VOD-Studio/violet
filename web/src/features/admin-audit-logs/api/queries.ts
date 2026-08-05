import { useQuery } from "@tanstack/react-query";
import type { AuditLogListQuery } from "../model/types";
import * as api from "./client";
import { auditLogKeys } from "./keys";

/** useAdminAuditLogs - 操作日志列表 hook（服务端分页） */
export const useAdminAuditLogs = (query: AuditLogListQuery = {}) =>
	useQuery({
		queryKey: auditLogKeys.list(query),
		queryFn: () => api.listAuditLogs(query),
	});

/** useAdminAuditLogsByUser - 指定用户操作日志列表 hook */
export const useAdminAuditLogsByUser = (userId: string, query: AuditLogListQuery = {}) =>
	useQuery({
		queryKey: auditLogKeys.userList(userId, query),
		queryFn: () => api.listAuditLogsByUser(userId, query),
		enabled: userId.length > 0,
	});
