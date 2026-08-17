/**
 * useClientPagination hook 测试
 *
 * 验证客户端分页契约：
 *   - 切片：返回当前页数据，total 报全量条数
 *   - 翻页：onChange(page) 后切片前移
 *   - 切换每页条数：页码重置为 1
 *   - 数据变少：页码自动收敛到最后一页，不出现空页
 */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_SIZE, useClientPagination } from "../utils/use-client-pagination";

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

		// 第三页 20 条删除后只剩 60 条：最大页码 2，原 page=3 收敛到 2
		rerender({ d: makeData(60) });
		expect(result.current.pagination.page).toBe(2);
		expect(result.current.pagedData).toEqual(makeData(60).slice(50, 60));
	});
});
