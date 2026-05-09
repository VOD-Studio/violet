/**
 * 用户筛选状态 hook
 * 管理搜索、角色、状态筛选
 */

import { useMemo, useState } from "react";
import type { UserStatus } from "@/features/admin/users";
import { useDebounce } from "@/hooks/useDebounce";

/** 筛选参数 */
export interface UsersFilterParams {
  /** 搜索关键词 */
  search?: string;
  /** 角色筛选 */
  role?: string;
  /** 状态筛选 */
  status?: UserStatus;
}

/** useUsersFilters 返回值 */
export interface UseUsersFiltersReturn {
  /** 搜索输入值 */
  search: string;
  /** 设置搜索值 */
  setSearch: (value: string) => void;
  /** 角色筛选值 */
  roleFilter: string;
  /** 设置角色筛选 */
  setRoleFilter: (value: string) => void;
  /** 状态筛选值 */
  statusFilter: string;
  /** 设置状态筛选 */
  setStatusFilter: (value: UserStatus | "all") => void;
  /** 防抖后的查询参数 */
  queryParams: UsersFilterParams;
}

/**
 * 用户筛选 hook
 */
export function useUsersFilters(): UseUsersFiltersReturn {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<UserStatus | "all">("all");

  const debouncedSearch = useDebounce(search, 300);

  const queryParams = useMemo<UsersFilterParams>(() => {
    const params: UsersFilterParams = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (roleFilter && roleFilter !== "all") params.role = roleFilter;
    if (statusFilter && statusFilter !== "all") params.status = statusFilter;
    return params;
  }, [debouncedSearch, roleFilter, statusFilter]);

  return {
    search,
    setSearch,
    roleFilter,
    setRoleFilter,
    statusFilter,
    setStatusFilter,
    queryParams,
  };
}
