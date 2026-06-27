/**
 * admin-roles API 客户端
 */
import { apiGet } from "@/shared/api/request";
import type { RoleDTO } from "../model/types";

/**
 * 获取所有角色列表
 *
 * GET /admin/roles
 * 返回所有角色（含 user_count）。需管理员权限。
 */
export const listRoles = async (): Promise<RoleDTO[]> => {
    return apiGet<RoleDTO[]>("/admin/roles");
};
