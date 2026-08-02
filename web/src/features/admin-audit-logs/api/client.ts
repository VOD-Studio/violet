import { apiGetPaged } from "@shared/api/request";
import type { PagedResponse } from "@shared/api/types";
import type { AuditEventDTO, AuditLogListQuery } from "../model/types";

const BASE = "/admin/logs";

/**
 * listAuditLogs - 调后端 GET /admin/logs 拉取操作日志列表（分页 + 过滤）
 */
export const listAuditLogs = async (
    query: AuditLogListQuery = {},
): Promise<PagedResponse<AuditEventDTO>> => apiGetPaged<AuditEventDTO>(BASE, { params: query });

/**
 * listAuditLogsByUser - 调后端 GET /admin/logs/user/{id} 拉取指定用户日志
 */
export const listAuditLogsByUser = async (
    userId: string,
    query: AuditLogListQuery = {},
): Promise<PagedResponse<AuditEventDTO>> =>
    apiGetPaged<AuditEventDTO>(`${BASE}/user/${userId}`, { params: query });
