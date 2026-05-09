/**
 * 用户选择状态 hook
 * 管理批量选择逻辑
 */

import { useCallback, useState } from "react";
import type { AdminUser } from "@/features/admin/users/types";

/** useUsersSelection 返回值 */
export interface UseUsersSelectionReturn {
  /** 已选中的用户 ID 集合 */
  selectedIds: Set<string>;
  /** 设置选中集合 */
  setSelectedIds: (ids: Set<string>) => void;
  /** 是否全选 */
  allSelected: boolean;
  /** 全选/取消全选 */
  toggleSelectAll: () => void;
  /** 切换单个用户选择 */
  toggleSelectOne: (userId: string) => void;
  /** 清空选择 */
  clearSelection: () => void;
}

/**
 * 用户选择 hook
 * @param users 用户列表，用于全选计算
 */
export function useUsersSelection(
  users: AdminUser[] = [],
): UseUsersSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const allSelected = users.length > 0 && selectedIds.size === users.length;

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(allSelected ? new Set() : new Set(users.map((u) => u.id)));
  }, [allSelected, users]);

  const toggleSelectOne = useCallback(
    (userId: string) => {
      const newSet = new Set(selectedIds);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      setSelectedIds(newSet);
    },
    [selectedIds],
  );

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  return {
    selectedIds,
    setSelectedIds,
    allSelected,
    toggleSelectAll,
    toggleSelectOne,
    clearSelection,
  };
}
