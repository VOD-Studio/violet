import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import Empty from "@/shared/ui/empty";
import { Skeleton } from "@/shared/ui/skeleton";
import { TableBody, TableCell, TableRow } from "@/shared/ui/table";
import type { DataTableColumn } from "./data-table-types";
import { cellStickyStyle, mergeStickyStyle, type StickyOffset } from "./sticky-utils";

const ALIGN_CLASS = {
	left: "text-left",
	center: "text-center",
	right: "text-right",
} as const;

/** 骨架行用固定 id，避免数组下标作为 key */
const SKELETON_ROWS = ["sk-1", "sk-2", "sk-3", "sk-4", "sk-5"];

interface DataTableBodyProps<T> {
	columns: DataTableColumn<T>[];
	data: T[];
	keyExtractor: (row: T) => string;
	offsets: Map<string, StickyOffset>;
	loading?: boolean;
	error?: Error | null;
	onRetry?: () => void;
	density: "comfortable" | "compact";
	emptyTitle?: string;
	emptyDescription?: string;
}

/**
 * DataTableBody - 数据行渲染
 *
 * 三态优先级：error > loading > empty > data。
 * 固定列单元格应用 sticky 样式（背景不透明遮挡横向滚动内容）。
 */
export function DataTableBody<T>({
	columns,
	data,
	keyExtractor,
	offsets,
	loading,
	error,
	onRetry,
	density,
	emptyTitle,
	emptyDescription,
}: DataTableBodyProps<T>) {
	const cellPad = density === "compact" ? "py-1.5" : "py-2.5";
	const colCount = columns.length;

	if (error) {
		return (
			<TableBody>
				<TableRow className="hover:bg-transparent">
					<TableCell colSpan={colCount} className="p-0">
						<div className="py-12" aria-live="assertive">
							<Empty
								title={emptyTitle ?? "ERROR"}
								description={error.message || "加载失败"}
								size="sm"
								action={
									onRetry ? (
										<Button variant="outline" size="sm" onClick={onRetry}>
											重试
										</Button>
									) : undefined
								}
							/>
						</div>
					</TableCell>
				</TableRow>
			</TableBody>
		);
	}

	if (loading) {
		return (
			<TableBody>
				{SKELETON_ROWS.map((sid) => (
					<TableRow key={sid} className="hover:bg-transparent">
						{columns.map((col) => {
							const offset = offsets.get(col.key);
							const sticky = cellStickyStyle(offset);
							return (
								<TableCell
									key={col.key}
									style={mergeStickyStyle(offset, col.width)}
									className={cn(cellPad, ALIGN_CLASS[col.align ?? "left"], sticky.className)}
								>
									<Skeleton className="h-4 w-full max-w-[10rem]" />
								</TableCell>
							);
						})}
					</TableRow>
				))}
			</TableBody>
		);
	}

	if (data.length === 0) {
		return (
			<TableBody>
				<TableRow className="hover:bg-transparent">
					<TableCell colSpan={colCount} className="p-0">
						<div className="py-12" aria-live="polite">
							<Empty
								title={emptyTitle ?? "NO_DATA"}
								description={emptyDescription ?? "暂无数据"}
								size="sm"
							/>
						</div>
					</TableCell>
				</TableRow>
			</TableBody>
		);
	}

	return (
		<TableBody>
			{data.map((row) => {
				const rowKey = keyExtractor(row);
				return (
					<TableRow key={rowKey}>
						{columns.map((col) => {
							const offset = offsets.get(col.key);
							const sticky = cellStickyStyle(offset);
							return (
								<TableCell
									key={col.key}
									style={mergeStickyStyle(offset, col.width)}
									className={cn(
										cellPad,
										ALIGN_CLASS[col.align ?? "left"],
										sticky.className,
										col.className,
									)}
								>
									{renderCell(col, row)}
								</TableCell>
							);
						})}
					</TableRow>
				);
			})}
		</TableBody>
	);
}

/** 渲染单元格：优先 cell 回调，否则按 accessorKey 直读 */
function renderCell<T>(col: DataTableColumn<T>, row: T): ReactNode {
	if (col.cell) return col.cell(row);
	if (col.accessorKey != null) {
		const value = row[col.accessorKey];
		if (value == null) return null;
		if (typeof value === "string" || typeof value === "number") return value;
		return String(value);
	}
	return null;
}
