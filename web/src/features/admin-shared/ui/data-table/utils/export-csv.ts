import type { DataTableColumn } from "../types/data-table-types";

const CSV_MIME = "text/csv;charset=utf-8;";
/** BOM 头，确保 Excel 正确识别 UTF-8 中文 */
const BOM = "\uFEFF";

/**
 * exportToCsv - 导出数据为 CSV 文件并触发下载
 *
 * 仅导出有 accessorKey 或 exportValue 的列；
 * cell 渲染的 ReactNode 无法提取文本，故不导出纯展示列。
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

/** 转义 CSV 字段：含逗号/引号/换行则用双引号包裹并转义内部引号 */
function escapeCsv(value: string): string {
    if (/[",\n\r]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

/** 列 header 转为字符串，用于 CSV 表头 */
function labelToString(header: unknown): string {
    if (typeof header === "string" || typeof header === "number") return String(header);
    return "";
}
