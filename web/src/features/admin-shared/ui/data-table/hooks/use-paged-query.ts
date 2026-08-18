import type { PagedResponse, PageQuery } from "@shared/api/types";
import type { UseQueryResult } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { DataTablePagination } from "../types/data-table-types";

/** 全站表格默认每页条数 */
export const DEFAULT_PAGE_SIZE = 50;

/** {@link usePagedQuery} 的可选配置 */
export interface UsePagedQueryOptions {
	/** 初始每页条数，默认 {@link DEFAULT_PAGE_SIZE} (50) */
	initialPageSize?: number;
}

/**
 * 服务端分页表格 Hook，管理分页状态并自动组装 {@link DataTablePagination}。
 *
 * @typeParam T - 列表项数据类型
 * @typeParam Q - 业务筛选参数类型（不含 page / limit）
 *
 * @param useList - 模块的列表查询 Hook（如 `useAdminUsers`）
 * @param baseQuery - 业务筛选参数对象，省略时查全部
 * @param options - 分页可选配置
 *
 * @returns 包含 `data`、`isLoading`、`pagination`、`page`、`pageSize`、`setPage` 的查询与分页对象
 *
 * @example
 * ```tsx
 * const { data: paged, isLoading, pagination, setPage } = usePagedQuery(useAdminUsers, {
 *   keyword,
 *   role: roleFilter,
 * });
 *
 * return <DataTable data={paged?.data ?? []} pagination={pagination} />;
 * ```
 */
export function usePagedQuery<T, Q extends object = Record<string, never>>(
	useList: (query: Q & PageQuery) => UseQueryResult<PagedResponse<T>>,
	baseQuery: Q = {} as Q,
	options?: UsePagedQueryOptions,
) {
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(options?.initialPageSize ?? DEFAULT_PAGE_SIZE);

	const query = useMemo(
		() => ({ ...baseQuery, page, limit: pageSize }) as Q & PageQuery,
		[baseQuery, page, pageSize],
	);

	const result = useList(query);

	const total = result.data?.pagination?.total ?? 0;
	const pagination = useMemo<DataTablePagination>(
		() => ({
			page,
			pageSize,
			total,
			onChange: (p, size) => {
				if (size !== pageSize) {
					setPageSize(size);
					setPage(1);
				} else {
					setPage(p);
				}
			},
		}),
		[page, pageSize, total],
	);

	return { ...result, page, pageSize, setPage, pagination };
}
