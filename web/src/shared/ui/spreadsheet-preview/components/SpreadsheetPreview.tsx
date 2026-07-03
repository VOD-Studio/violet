/**
 * 表格文档预览主组件（SheetJS）
 *
 * 功能：
 * - .xlsx/.xls 解析为 HTML 表格预览
 * - 多工作表标签页切换
 * - 表头行高亮、空数据兜底
 * - 加载/错误状态 + 重试
 * - 下载
 */

import { AlertCircle, Download, RotateCcw, Table } from "lucide-react";
import { Button } from "@/shared/ui/base/button";
import { useSpreadsheet } from "../hooks/useSpreadsheet";
import type { CellValue, SpreadsheetPreviewProps } from "../types/spreadsheet-preview-types";

export function SpreadsheetPreview({ url, name, className }: SpreadsheetPreviewProps) {
    const { sheets, activeSheet, activeIndex, loadStatus, setActiveIndex, retry } = useSpreadsheet({
        url,
    });

    function handleDownload() {
        const a = document.createElement("a");
        a.href = url;
        a.download = name ?? "spreadsheet.xlsx";
        a.click();
    }

    return (
        <div
            className={`flex flex-col overflow-hidden rounded-lg border bg-background ${className ?? ""}`}
        >
            {/* 顶部操作条 */}
            <div className="flex items-center justify-between border-b px-3 py-1.5">
                <span className="truncate text-xs text-muted-foreground">
                    {name ?? "Excel 表格"}
                </span>
                <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={handleDownload}
                    title="下载"
                >
                    <Download className="size-3.5" />
                </Button>
            </div>

            {/* sheet 标签页（多个时显示） */}
            {loadStatus === "ready" && sheets.length > 1 ? (
                <div className="flex gap-1 overflow-x-auto border-b bg-muted/30 px-2 py-1.5">
                    {sheets.map((sheet, i) => (
                        <button
                            type="button"
                            key={sheet.name}
                            onClick={() => setActiveIndex(i)}
                            className={`whitespace-nowrap rounded px-2 py-1 text-xs transition-colors ${i === activeIndex ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:bg-background/50"}`}
                        >
                            {sheet.name}
                        </button>
                    ))}
                </div>
            ) : null}

            {/* 表格区 */}
            <div className="max-h-[70vh] overflow-auto">
                {loadStatus === "loading" ? (
                    <div className="flex h-40 items-center justify-center">
                        <div className="size-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
                    </div>
                ) : loadStatus === "error" ? (
                    <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
                        <AlertCircle className="size-8 text-red-500" />
                        <span className="text-sm">表格加载失败</span>
                        <Button type="button" variant="outline" size="sm" onClick={retry}>
                            <RotateCcw className="mr-1.5 size-3.5" />
                            重试
                        </Button>
                    </div>
                ) : activeSheet && activeSheet.data.length > 0 ? (
                    <table className="w-full border-collapse text-xs">
                        <tbody>
                            {activeSheet.data.map((row, rowIdx) => (
                                <tr
                                    key={`row-${rowIdx}`}
                                    className={
                                        rowIdx === 0
                                            ? "bg-muted/50 font-medium"
                                            : "hover:bg-muted/30"
                                    }
                                >
                                    {/* 行号 */}
                                    <td className="border-border px-2 py-1 text-right text-muted-foreground/60 tabular-nums">
                                        {rowIdx + 1}
                                    </td>
                                    {row.map((cell, colIdx) => (
                                        <td
                                            key={`cell-${rowIdx}-${colIdx}`}
                                            className="border-border px-2 py-1"
                                        >
                                            {renderCell(cell)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Table className="size-8 opacity-40" />
                        <span className="text-xs">该工作表为空</span>
                    </div>
                )}
            </div>
        </div>
    );
}

/** 渲染单元格值 */
function renderCell(cell: CellValue) {
    if (cell === null || cell === undefined || cell === "") return "—";
    if (cell instanceof Date) return cell.toLocaleString("zh-CN");
    return String(cell);
}
