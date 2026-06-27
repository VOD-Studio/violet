import { describe, expect, it } from "vitest";
import { computeStickyOffsets } from "../sticky-utils";
import type { DataTableColumn } from "../data-table-types";

describe("sticky-utils", () => {
	describe("computeStickyOffsets", () => {
		it("应该标记最后一个左固定列显示阴影", () => {
			const columns: DataTableColumn<any>[] = [
				{ key: "select", sticky: "left", width: "48px" },
				{ key: "expand", sticky: "left", width: "48px" },
				{ key: "name", sticky: "left", width: "200px" },
				{ key: "email" },
				{ key: "status" },
			];

			const offsets = computeStickyOffsets(columns);

			// 选择列：不是最后一个，不显示阴影
			expect(offsets.get("select")).toEqual({
				side: "left",
				offset: "0px",
				isLast: false,
			});

			// 展开列：不是最后一个，不显示阴影
			expect(offsets.get("expand")).toEqual({
				side: "left",
				offset: "48px",
				isLast: false,
			});

			// 名称列：是最后一个左固定列，显示阴影
			expect(offsets.get("name")).toEqual({
				side: "left",
				offset: "96px",
				isLast: true,
			});

			// 非固定列不应该有偏移信息
			expect(offsets.get("email")).toBeUndefined();
			expect(offsets.get("status")).toBeUndefined();
		});

		it("应该标记第一个右固定列显示阴影", () => {
			const columns: DataTableColumn<any>[] = [
				{ key: "name" },
				{ key: "email" },
				{ key: "edit", sticky: "right", width: "80px" },
				{ key: "delete", sticky: "right", width: "80px" },
			];

			const offsets = computeStickyOffsets(columns);

			// 编辑列：是第一个右固定列（从左往右看），显示阴影
			expect(offsets.get("edit")).toEqual({
				side: "right",
				offset: "80px",
				isLast: true,
			});

			// 删除列：不是第一个，不显示阴影
			expect(offsets.get("delete")).toEqual({
				side: "right",
				offset: "0px",
				isLast: false,
			});
		});

		it("应该处理只有一个固定列的情况", () => {
			const columns: DataTableColumn<any>[] = [
				{ key: "select", sticky: "left", width: "48px" },
				{ key: "name" },
				{ key: "email" },
			];

			const offsets = computeStickyOffsets(columns);

			// 唯一的固定列应该显示阴影
			expect(offsets.get("select")).toEqual({
				side: "left",
				offset: "0px",
				isLast: true,
			});
		});

		it("应该处理左右都有固定列的情况", () => {
			const columns: DataTableColumn<any>[] = [
				{ key: "select", sticky: "left", width: "48px" },
				{ key: "name", sticky: "left", width: "200px" },
				{ key: "email" },
				{ key: "status" },
				{ key: "actions", sticky: "right", width: "100px" },
			];

			const offsets = computeStickyOffsets(columns);

			// 名称列：最后一个左固定列
			expect(offsets.get("name")).toEqual({
				side: "left",
				offset: "48px",
				isLast: true,
			});

			// 操作列：唯一的右固定列
			expect(offsets.get("actions")).toEqual({
				side: "right",
				offset: "0px",
				isLast: true,
			});

			// 选择列：不是最后一个左固定列
			expect(offsets.get("select")?.isLast).toBe(false);
		});
	});
});
