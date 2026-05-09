/**
 * 用户管理页面组合 hook
 * 组合筛选、分页、选择、mutations 等 hooks
 */

import { useEffect, useMemo } from "react";
import {
  getRoleLabel,
  toRoleConfig,
  useAdminUsers,
  useRoles,
  useUserMutations,
} from "@/features/admin/users";
import { useUsersFilters } from "./useUsersFilters";
import { useUsersPagination } from "./useUsersPagination";
import { useUsersSelection } from "./useUsersSelection";

/**
 * 用户管理页面 hook
 */
export function useUsersPage() {
  // 角色列表（从 API 获取）
  const { data: rolesData, isLoading: rolesLoading } = useRoles();
  const roles = rolesData ?? [];
  const roleConfigs = toRoleConfig(roles);
  const roleFilterOptions = [
    { value: "all", label: "全部角色" },
    ...roleConfigs,
  ];

  // 筛选
  const {
    search,
    setSearch,
    roleFilter,
    setRoleFilter,
    statusFilter,
    setStatusFilter,
    queryParams,
  } = useUsersFilters();

  // 分页
  const { page, setPage, limit, total, setTotal } = useUsersPagination();

  // 查询参数合并分页
  const fullQueryParams = useMemo(
    () => ({ ...queryParams, page, limit }),
    [queryParams, page, limit],
  );

  // 数据查询
  const {
    data: response,
    isLoading,
    error,
    refetch,
  } = useAdminUsers(fullQueryParams);
  const users = response?.users ?? [];
  const responseTotal = response?.total ?? 0;

  // 同步总数到分页状态（副作用移至 useEffect）
  useEffect(() => {
    setTotal(responseTotal);
  }, [responseTotal, setTotal]);

  // 筛选参数变化时重置页码
  useEffect(() => {
    setPage(1);
  }, [setPage]);

  // 选择
  const {
    selectedIds,
    setSelectedIds,
    allSelected,
    toggleSelectAll,
    toggleSelectOne,
    clearSelection,
  } = useUsersSelection(users);

  // mutations
  const {
    createUser,
    updateUser,
    deleteUser,
    batchUpdateStatus,
    batchUpdateRole,
    handleCreateUser,
    handleUpdateUser,
    handleDeleteUser,
    handleRoleChange,
    handleToggleStatus,
    handleBatchStatus,
    handleBatchRole,
  } = useUserMutations(roles);

  return {
    // 角色
    roles,
    roleConfigs,
    roleFilterOptions,
    rolesLoading,
    getRoleLabel: (roleName: string) => getRoleLabel(roleName, roles),
    // 筛选
    search,
    setSearch,
    roleFilter,
    setRoleFilter,
    statusFilter,
    setStatusFilter,
    // 分页
    page,
    setPage,
    limit,
    total,
    // 数据
    users,
    isLoading,
    error,
    refetch,
    // 选择
    selectedIds,
    setSelectedIds,
    allSelected,
    toggleSelectAll,
    toggleSelectOne,
    clearSelection,
    // mutations
    createUser,
    updateUser,
    deleteUser,
    batchUpdateStatus,
    batchUpdateRole,
    // handlers
    handleCreateUser,
    handleUpdateUser,
    handleDeleteUser,
    handleRoleChange,
    handleToggleStatus,
    handleBatchStatus,
    handleBatchRole,
  };
}
