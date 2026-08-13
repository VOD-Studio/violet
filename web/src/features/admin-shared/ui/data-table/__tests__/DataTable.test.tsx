/**
 * DataTable 回归测试
 *
 * 核心场景：列定义中的 width 属性必须正确应用到 colgroup 的 col 上，
 * 包括 "120px"、百分比 "20%" 等 CSS 宽度值。
 */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataTable } from "../components/DataTable";
import type { DataTableColumn } from "../types/data-table-types";

interface Row {
	id: string;
	name: string;
	email: string;
}

const columns: DataTableColumn<Row>[] = [
	{ key: "name", header: "名称", width: "120px" },
	{ key: "email", header: "邮箱", width: "20%" },
];

const data: Row[] = [
	{ id: "1", name: "Alice", email: "alice@example.com" },
	{ id: "2", name: "Bob", email: "bob@example.com" },
];

describe("DataTable", () => {
	it("将列宽应用到 colgroup 的 col 元素上", () => {
		const { container } = render(
			<DataTable
				columns={columns}
				data={data}
				keyExtractor={(r) => r.id}
				pagination={{ page: 1, pageSize: 10, total: 2, onChange: () => {} }}
				density="comfortable"
			/>,
		);

		// header 和 body 各有独立 table + colgroup，验证 header 表的 col
		const headerCols = container
			.querySelector("thead")
			?.closest("table")
			?.querySelectorAll("colgroup col");
		expect(headerCols).toHaveLength(2);
		expect(headerCols?.[0]).toBeInstanceOf(HTMLTableColElement);
		expect(headerCols?.[1]).toBeInstanceOf(HTMLTableColElement);
		if (headerCols?.[0] instanceof HTMLTableColElement) {
			expect(headerCols[0].style.width).toBe("120px");
		}
		if (headerCols?.[1] instanceof HTMLTableColElement) {
			expect(headerCols[1].style.width).toBe("20%");
		}
	});
});
