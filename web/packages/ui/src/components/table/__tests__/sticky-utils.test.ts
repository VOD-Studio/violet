import { describe, expect, it } from "vitest";
import type { DataTableColumn } from "../data-table-types";
import { computeStickyOffsets, stickyProps } from "../sticky-utils";

type Col = DataTableColumn<unknown>;

describe("computeStickyOffsets", () => {
	it("左固定列按宽度累加偏移，只有最靠内的一列带边缘标记", () => {
		const columns: Col[] = [
			{ key: "select", header: "", sticky: "left", width: "36px" },
			{ key: "expand", header: "", sticky: "left", width: "32px" },
			{ key: "name", header: "名称", sticky: "left", width: "200px" },
			{ key: "email", header: "邮箱" },
		];

		const offsets = computeStickyOffsets(columns);

		expect(offsets.get("select")).toEqual({ side: "left", offset: "0px", isLast: false });
		expect(offsets.get("expand")).toEqual({ side: "left", offset: "36px", isLast: false });
		expect(offsets.get("name")).toEqual({ side: "left", offset: "68px", isLast: true });
		expect(offsets.get("email")).toBeUndefined();
	});

	it("右固定列从右往左累加，最靠左的一列带边缘标记", () => {
		const columns: Col[] = [
			{ key: "name", header: "名称" },
			{ key: "edit", header: "编辑", sticky: "right", width: "80px" },
			{ key: "delete", header: "删除", sticky: "right", width: "60px" },
		];

		const offsets = computeStickyOffsets(columns);

		expect(offsets.get("edit")).toEqual({ side: "right", offset: "60px", isLast: true });
		expect(offsets.get("delete")).toEqual({ side: "right", offset: "0px", isLast: false });
	});

	it("左右都有固定列时各自独立", () => {
		const columns: Col[] = [
			{ key: "select", header: "", sticky: "left", width: "36px" },
			{ key: "email", header: "邮箱" },
			{ key: "actions", header: "操作", sticky: "right", width: "100px" },
		];

		const offsets = computeStickyOffsets(columns);

		expect(offsets.get("select")).toEqual({ side: "left", offset: "0px", isLast: true });
		expect(offsets.get("actions")).toEqual({ side: "right", offset: "0px", isLast: true });
	});

	it("实际宽度（拖拽或内容适配后）优先于声明宽度", () => {
		const columns: Col[] = [
			{ key: "a", header: "A", sticky: "left", width: "100px" },
			{ key: "b", header: "B", sticky: "left", width: "100px" },
		];

		const offsets = computeStickyOffsets(columns, new Map([["a", 150]]));

		expect(offsets.get("b")?.offset).toBe("150px");
	});

	it("非 px 宽度无法累加，按 0 处理", () => {
		const columns: Col[] = [
			{ key: "a", header: "A", sticky: "left", width: "20%" },
			{ key: "b", header: "B", sticky: "left", width: "100px" },
		];

		expect(computeStickyOffsets(columns).get("b")?.offset).toBe("0px");
	});
});

describe("stickyProps", () => {
	it("左固定写 left，边缘列带 data-sticky-edge", () => {
		expect(stickyProps({ side: "left", offset: "36px", isLast: true })).toEqual({
			"data-sticky": "left",
			"data-sticky-edge": "",
			style: { left: "36px" },
		});
	});

	it("右固定写 right，非边缘列没有边缘标记", () => {
		expect(stickyProps({ side: "right", offset: "0px", isLast: false })).toEqual({
			"data-sticky": "right",
			"data-sticky-edge": undefined,
			style: { right: "0px" },
		});
	});

	it("非固定列没有任何属性", () => {
		expect(stickyProps(undefined)).toEqual({});
	});
});
