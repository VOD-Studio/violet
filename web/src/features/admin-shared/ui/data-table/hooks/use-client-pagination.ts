import { useMemo, useState } from "react";
import type { DataTablePagination } from "../types/data-table-types";
import { DEFAULT_PAGE_SIZE } from "./use-paged-query";

/**
 * 客户端全量列表分页 Hook，对内存数组进行切片并生成 {@link DataTablePagination}。
 *
 * @remarks
 * 数据量减少（删除、筛选）后，若当前页码超出最大页数，自动收敛到最后一页。
 *
 * @typeParam T - 列表项数据类型
 *
 * @param data - 全量数据数组
 * @param initialPageSize - 初始每页条数，默认 50
 *
 * @returns 包含当前页切片 `pagedData` 与 `pagination` 配置的对象
 *
 * @example
 * ```tsx
 * const { pagedData, pagination } = useClientPagination(flatRows);
 *
 * return <DataTable data={pagedData} pagination={pagination} />;
 * ```
 */
export function useClientPagination<T>(data: T[], initialPageSize = DEFAULT_PAGE_SIZE) {
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(initialPageSize);

	const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
	const safePage = Math.min(page, totalPages);

	const pagedData = useMemo(
		() => data.slice((safePage - 1) * pageSize, safePage * pageSize),
		[data, safePage, pageSize],
	);

	const pagination = useMemo<DataTablePagination>(
		() => ({
			page: safePage,
			pageSize,
			total: data.length,
			onChange: (p, size) => {
				if (size !== pageSize) {
					setPageSize(size);
					setPage(1);
				} else {
					setPage(p);
				}
			},
		}),
		[safePage, pageSize, data.length],
	);

	return { pagedData, pagination };
}
