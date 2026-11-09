import type { DataTableColumn } from "./data-table-types";

const CSV_MIME = "text/csv;charset=utf-8;";
/** Excel 靠 BOM 识别 UTF-8，否则中文乱码 */
const BOM = "\uFEFF";

/**
 * 把行数据导出为 CSV 并触发下载。
 *
 * 只导出有 `accessorKey` 或 `exportValue` 的列：`cell` 渲染出的 ReactNode 取不出文本，纯展示列不导出。
 * 表头只认字符串或数字，其余为空。
 */
export function exportToCsv<T>(filename: string, columns: DataTableColumn<T>[], rows: T[]): void {
	const exportable = columns.filter((c) => c.accessorKey != null || c.exportValue != null);

	const header = exportable.map((c) => escapeCsv(labelToString(c.header))).join(",");
	const body = rows
		.map((row) =>
			exportable
				.map((c) => {
					const raw = c.exportValue
						? c.exportValue(row)
						: c.accessorKey != null
							? (row[c.accessorKey] as unknown)
							: null;
					return escapeCsv(raw == null ? "" : String(raw));
				})
				.join(","),
		)
		.join("\n");

	const csv = `${BOM}${header}\n${body}`;
	const blob = new Blob([csv], { type: CSV_MIME });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}

/** 含逗号、引号或换行的字段用双引号包裹并转义内部引号 */
function escapeCsv(value: string): string {
	if (/[",\n\r]/.test(value)) {
		return `"${value.replace(/"/g, '""')}"`;
	}
	return value;
}

function labelToString(header: unknown): string {
	if (typeof header === "string" || typeof header === "number") return String(header);
	return "";
}
