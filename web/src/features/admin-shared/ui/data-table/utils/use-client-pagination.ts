import { useMemo, useState } from "react";
import type { DataTablePagination } from "../types/data-table-types";

/** 全站表格默认每页条数 */
export const DEFAULT_PAGE_SIZE = 50;

/**
 * useTablePagination - 表格分页状态（服务端分页页面统一入口）
 *
 * 管理 page/pageSize 状态；total 来自 query 结果，声明顺序在 query 之后，
 * 故以 withTotal(total) 在 JSX 处组装 pagination：
 *
 *   const { page, pageSize, setPage, withTotal } = useTablePagination();
 *   const { data: paged } = useAdminUsers({ page, limit: pageSize });
 *   <DataTable pagination={withTotal(paged?.pagination?.total ?? 0)} />
 *
 * 语义：翻页只变 page；切换每页条数时 pageSize 变化且 page 重置为 1。
 * 筛选条件变化需重置页码时调用 setPage(1)。
 */
export function useTablePagination(initialPageSize = DEFAULT_PAGE_SIZE) {
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(initialPageSize);

	const withTotal = (total: number): DataTablePagination => ({
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
	});

	return { page, pageSize, setPage, withTotal };
}

/**
 * useClientPagination - 前端全量列表的客户端分页
 *
 * 数据已由调用方全量取回（permissions 树等），此处按页切片并拼装 DataTable 的
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
