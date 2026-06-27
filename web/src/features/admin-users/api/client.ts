/**
 * admin-users API 客户端
 *
 * 封装所有 /admin/users 相关的 API 调用
 */
import { apiDelete, apiGet, apiGetPaged, apiPatch, apiPost } from "@/shared/api/request";
import type {
    AdminUserDTO,
    BatchUpdateResponse,
    BatchUpdateRoleRequest,
    BatchUpdateStatusRequest,
    CreateUserRequest,
    ListUsersRequest,
    UpdateUserRequest,
    UpdateUserRoleRequest,
    UpdateUserStatusRequest,
} from "../model/types";
import type { PagedResponse } from "@/shared/api/types";

/**
 * 获取用户列表（分页 + 筛选）
 */
export const listUsers = async (params: ListUsersRequest): Promise<PagedResponse<AdminUserDTO>> => {
    return apiGetPaged<AdminUserDTO>("/admin/users", { params });
};

/**
 * 获取用户详情
 */
export const getUserDetail = async (id: string): Promise<AdminUserDTO> => {
    return apiGet<AdminUserDTO>(`/admin/users/${id}`);
};

/**
 * 创建用户
 */
export const createUser = async (data: CreateUserRequest): Promise<AdminUserDTO> => {
    return apiPost<AdminUserDTO>("/admin/users", data);
};

/**
 * 更新用户
 */
export const updateUser = async (id: string, data: UpdateUserRequest): Promise<AdminUserDTO> => {
    return apiPatch<AdminUserDTO>(`/admin/users/${id}`, data);
};

/**
 * 删除用户
 */
export const deleteUser = async (id: string): Promise<void> => {
    return apiDelete<void>(`/admin/users/${id}`);
};

/**
 * 修改用户角色
 */
export const updateUserRole = async (id: string, data: UpdateUserRoleRequest): Promise<void> => {
    return apiPatch<void>(`/admin/users/${id}/role`, data);
};

/**
 * 修改用户状态
 */
export const updateUserStatus = async (id: string, data: UpdateUserStatusRequest): Promise<void> => {
    return apiPatch<void>(`/admin/users/${id}/status`, data);
};

/**
 * 批量启用/禁用用户
 */
export const batchUpdateStatus = async (
    data: BatchUpdateStatusRequest,
): Promise<BatchUpdateResponse> => {
    return apiPost<BatchUpdateResponse>("/admin/users/batch/status", data);
};

/**
 * 批量修改用户角色
 */
export const batchUpdateRole = async (data: BatchUpdateRoleRequest): Promise<BatchUpdateResponse> => {
    return apiPost<BatchUpdateResponse>("/admin/users/batch/role", data);
};
