/**
 * admin-roles TanStack Query Hooks
 */
import { useQuery } from "@tanstack/react-query";
import * as api from "./client";
import { adminRolesKeys } from "./keys";

/**
 * useAdminRoles - 查询角色列表
 */
export const useAdminRoles = () => {
    return useQuery({
        queryKey: adminRolesKeys.list(),
        queryFn: () => api.listRoles(),
        staleTime: 30 * 60 * 1000, // 30 分钟（角色变化不频繁）
    });
};
