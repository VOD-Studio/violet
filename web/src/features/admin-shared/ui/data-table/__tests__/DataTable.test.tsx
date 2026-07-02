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
                page={1}
                pageSize={10}
                total={2}
                onPageChange={() => {}}
                density="comfortable"
            />,
        );

        const cols = container.querySelectorAll("colgroup col");
        expect(cols).toHaveLength(2);
        expect(cols[0]).toBeInstanceOf(HTMLTableColElement);
        expect(cols[1]).toBeInstanceOf(HTMLTableColElement);
        if (cols[0] instanceof HTMLTableColElement) {
            expect(cols[0].style.width).toBe("120px");
        }
        if (cols[1] instanceof HTMLTableColElement) {
            expect(cols[1].style.width).toBe("20%");
        }
    });
});
