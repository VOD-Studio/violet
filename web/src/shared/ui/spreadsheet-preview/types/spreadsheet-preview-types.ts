/**
 * 表格文档预览类型定义
 */

/** 加载状态 */
export type SpreadsheetLoadStatus = "loading" | "ready" | "error";

/** 单元格值（可能为字符串/数字/布尔/日期/空） */
export type CellValue = string | number | boolean | Date | null;

/** 一个工作表的数据：行 -> 单元格值数组 */
export type SheetData = CellValue[][];

/** Spreadsheet 预览组件属性 */
export interface SpreadsheetPreviewProps {
	/** .xlsx/.xls 文件 URL */
	url: string;
	/** 文件标题 */
	name?: string;
	/** 自定义类名 */
	className?: string;
}
