/**
 * 用户分页状态 hook
 * 管理分页参数
 */

import { useState } from "react";

/** useUsersPagination 返回值 */
export interface UseUsersPaginationReturn {
  /** 当前页码 */
  page: number;
  /** 设置页码 */
  setPage: (page: number) => void;
  /** 每页数量 */
  limit: number;
  /** 总数量 */
  total: number;
  /** 设置总数量 */
  setTotal: (total: number) => void;
}

/**
 * 用户分页 hook
 */
export function useUsersPagination(): UseUsersPaginationReturn {
  const [page, setPage] = useState(1);
  const limit = 10;
  const [total, setTotal] = useState(0);

  return {
    page,
    setPage,
    limit,
    total,
    setTotal,
  };
}
