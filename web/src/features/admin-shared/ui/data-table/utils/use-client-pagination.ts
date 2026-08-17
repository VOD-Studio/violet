import { useMemo, useState } from "react";
import type { DataTableProps } from "../types/data-table-types";

/** 全站表格默认每页条数 */
export const DEFAULT_PAGE_SIZE = 50;

/**
 * useClientPagination - 前端全量列表的客户端分页
 *
 * 数据已由调用方全量取回（tags/roles 等），此处按页切片并拼装 DataTable 的
 * pagination 配置。数据变少（删除/过滤）后页码自动收敛到最后一页。
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

	const pagination = useMemo<NonNullable<DataTableProps<T>["pagination"]>>(
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
