/**
 * data-table hooks 测试
 *
 * 验证 useClientPagination 与 usePagedQuery 契约：
 *   - 客户端切片 / 翻页 / 切换条数 / 页码收敛
 *   - 服务端分页 query 拼装 / 组装 DataTablePagination
 */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useClientPagination } from "../hooks/use-client-pagination";
import { DEFAULT_PAGE_SIZE, usePagedQuery } from "../hooks/use-paged-query";

function makeData(n: number) {
	return Array.from({ length: n }, (_, i) => i);
}

describe("useClientPagination", () => {
	it("默认每页 50 条，首页返回前 50 个元素，total 为全量条数", () => {
		const data = makeData(120);
		const { result } = renderHook(() => useClientPagination(data));

		expect(DEFAULT_PAGE_SIZE).toBe(50);
		expect(result.current.pagedData).toEqual(data.slice(0, 50));
		expect(result.current.pagination).toMatchObject({ page: 1, pageSize: 50, total: 120 });
	});

	it("数据不足一页时全部返回", () => {
		const data = makeData(7);
		const { result } = renderHook(() => useClientPagination(data));

		expect(result.current.pagedData).toEqual(data);
		expect(result.current.pagination.total).toBe(7);
	});

	it("翻页后切片跟随页码前移", () => {
		const data = makeData(120);
		const { result } = renderHook(() => useClientPagination(data));

		act(() => result.current.pagination.onChange(2, 50));

		expect(result.current.pagedData).toEqual(data.slice(50, 100));
		expect(result.current.pagination.page).toBe(2);
	});

	it("切换每页条数时页码重置为 1", () => {
		const data = makeData(120);
		const { result } = renderHook(() => useClientPagination(data));

		act(() => result.current.pagination.onChange(3, 50));
		act(() => result.current.pagination.onChange(1, 10));

		expect(result.current.pagination.page).toBe(1);
		expect(result.current.pagination.pageSize).toBe(10);
		expect(result.current.pagedData).toEqual(data.slice(0, 10));
	});

	it("数据变少后页码收敛到最后一页，不渲染空页", () => {
		const data = makeData(120);
		const { result, rerender } = renderHook(({ d }) => useClientPagination(d), {
			initialProps: { d: data },
		});

		act(() => result.current.pagination.onChange(3, 50));
		expect(result.current.pagination.page).toBe(3);

		rerender({ d: makeData(60) });
		expect(result.current.pagination.page).toBe(2);
		expect(result.current.pagedData).toEqual(makeData(60).slice(50, 60));
	});
});

describe("usePagedQuery", () => {
	it("拼装 PageQuery 传给 query hook，并从返回结果提取 total 组装 pagination", () => {
		const mockUseQuery = vi.fn().mockImplementation((query) => ({
			data: {
				data: [`item-${query.page}`],
				pagination: { page: query.page, limit: query.limit, total: 95 },
			},
			isLoading: false,
		}));

		const { result } = renderHook(() =>
			usePagedQuery(mockUseQuery, { role: "admin" }, { initialPageSize: 20 }),
		);

		expect(mockUseQuery).toHaveBeenCalledWith({ role: "admin", page: 1, limit: 20 });
		expect(result.current.page).toBe(1);
		expect(result.current.pageSize).toBe(20);
		expect(result.current.pagination).toMatchObject({
			page: 1,
			pageSize: 20,
			total: 95,
		});

		// 翻页
		act(() => result.current.pagination.onChange(2, 20));
		expect(result.current.page).toBe(2);
		expect(mockUseQuery).toHaveBeenLastCalledWith({ role: "admin", page: 2, limit: 20 });

		// 切换每页条数重置页码为 1
		act(() => result.current.pagination.onChange(1, 50));
		expect(result.current.page).toBe(1);
		expect(result.current.pageSize).toBe(50);
		expect(mockUseQuery).toHaveBeenLastCalledWith({ role: "admin", page: 1, limit: 50 });
	});

	it("baseQuery 为空时可省略第二个参数", () => {
		const mockUseQuery = vi.fn().mockReturnValue({
			data: { data: [], pagination: { total: 0, limit: 50 } },
		});

		renderHook(() => usePagedQuery(mockUseQuery));

		expect(mockUseQuery).toHaveBeenCalledWith({ page: 1, limit: 50 });
	});
});
