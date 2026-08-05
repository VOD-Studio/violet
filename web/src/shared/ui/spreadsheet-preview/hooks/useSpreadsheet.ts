/**
 * 表格解析 Hook
 *
 * 使用 SheetJS (xlsx) 解析 Excel 文件为二维数组数据，
 * 支持多工作表，管理加载/错误状态与当前选中 sheet。
 */

import { useCallback, useEffect, useState } from "react";
import * as XLSX from "xlsx";
import type { SheetData, SpreadsheetLoadStatus } from "../types/spreadsheet-preview-types";

interface ParsedSheet {
	/** 工作表名称 */
	name: string;
	/** 二维表格数据 */
	data: SheetData;
}

interface UseSpreadsheetOptions {
	url: string;
}

export function useSpreadsheet({ url }: UseSpreadsheetOptions) {
	const [sheets, setSheets] = useState<ParsedSheet[]>([]);
	const [activeIndex, setActiveIndex] = useState(0);
	const [loadStatus, setLoadStatus] = useState<SpreadsheetLoadStatus>("loading");

	const parse = useCallback(async () => {
		setLoadStatus("loading");
		try {
			const res = await fetch(url);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const buffer = await res.arrayBuffer();
			const workbook = XLSX.read(buffer, { type: "array" });

			const parsed: ParsedSheet[] = workbook.SheetNames.map((sheetName) => {
				const sheet = workbook.Sheets[sheetName];
				// header:1 返回数组的数组（每行为单元格值数组）
				const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
					header: 1,
					blankrows: false,
					defval: null,
				}) as SheetData;
				return { name: sheetName, data };
			});

			setSheets(parsed);
			setActiveIndex(0);
			setLoadStatus(parsed.length > 0 ? "ready" : "error");
		} catch {
			setLoadStatus("error");
		}
	}, [url]);

	useEffect(() => {
		void parse();
	}, [parse]);

	const retry = useCallback(() => {
		void parse();
	}, [parse]);

	return {
		sheets,
		activeSheet: sheets[activeIndex] ?? null,
		activeIndex,
		loadStatus,
		setActiveIndex,
		retry,
	};
}
