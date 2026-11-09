import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DataTableColumn } from "../data-table-types";
import { exportToCsv } from "../export-csv";

interface Row {
	title: string;
	views: number;
	note: string | null;
}

const columns: DataTableColumn<Row>[] = [
	{ key: "title", header: "标题", accessorKey: "title" },
	{ key: "views", header: "浏览", exportValue: (row) => `${row.views} 次` },
	{ key: "note", header: "备注", accessorKey: "note" },
	{ key: "actions", header: "操作", cell: () => "按钮" },
];

describe("exportToCsv", () => {
	let blobParts: BlobPart[] = [];
	let blobType: string | undefined;
	let downloaded: string | undefined;

	beforeEach(() => {
		blobParts = [];
		blobType = undefined;
		downloaded = undefined;
		vi.stubGlobal(
			"Blob",
			class {
				constructor(parts: BlobPart[], options?: BlobPropertyBag) {
					blobParts = parts;
					blobType = options?.type;
				}
			},
		);
		URL.createObjectURL = vi.fn(() => "blob:csv");
		URL.revokeObjectURL = vi.fn();
		vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
			this: HTMLAnchorElement,
		) {
			downloaded = this.download;
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("以 BOM 开头，让 Excel 正确识别 UTF-8 中文", () => {
		exportToCsv("文章", columns, [{ title: "独库公路", views: 3, note: null }]);

		expect(String(blobParts[0]).startsWith("\uFEFF标题,")).toBe(true);
		expect(blobType).toContain("text/csv");
	});

	it("只导出有 accessorKey 或 exportValue 的列，exportValue 优先取值", () => {
		exportToCsv("文章", columns, [{ title: "独库公路", views: 3, note: null }]);

		expect(String(blobParts[0])).toBe("\uFEFF标题,浏览,备注\n独库公路,3 次,");
	});

	it("含逗号、引号与换行的字段加引号并转义", () => {
		exportToCsv("文章", columns, [{ title: 'a,"b"', views: 1, note: "第一行\n第二行" }]);

		expect(String(blobParts[0])).toBe('\uFEFF标题,浏览,备注\n"a,""b""",1 次,"第一行\n第二行"');
	});

	it("文件名没有 .csv 后缀时补上", () => {
		exportToCsv("文章", columns, []);
		expect(downloaded).toBe("文章.csv");

		exportToCsv("文章.csv", columns, []);
		expect(downloaded).toBe("文章.csv");
	});

	it("下载后释放对象地址", () => {
		exportToCsv("文章", columns, []);

		expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:csv");
	});
});
