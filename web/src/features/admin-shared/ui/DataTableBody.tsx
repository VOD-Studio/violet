import { Fragment, type ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import Empty from "@/shared/ui/empty";
import { Skeleton } from "@/shared/ui/skeleton";
import { TableBody, TableCell, TableRow } from "@/shared/ui/table";
import type { DataTableColumn } from "./data-table-types";
import { EXPAND_COLUMN_KEY, SELECT_COLUMN_KEY } from "./data-table-types";
import { RowCheckbox } from "./RowCheckbox";
import { RowExpander } from "./RowExpander";
import { cellStickyStyle, mergeStickyStyle, type StickyOffset } from "./sticky-utils";

const ALIGN_CLASS = {
	left: "text-left",
	center: "text-center",
	right: "text-right",
} as const;

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
	/** 筛选态：为 true 且无数据时使用"未找到匹配结果"文案 */
	filtered?: boolean;
	emptyTitle?: string;
	emptyDescription?: string;
	selectable: boolean;
	selectedIds: Set<string>;
	onToggleRow: (id: string) => void;
	expandable: boolean;
	expandedRowKeys: Set<string>;
	onToggleExpand: (id: string) => void;
	renderExpandedRow?: (row: T) => ReactNode;
	/** 整行点击回调，提供后行显示 cursor-pointer */
	onRowClick?: (row: T) => void;
	/** 当前页首行在全集中的序号（用于全局 aria-rowindex），通常 (page-1)*pageSize */
	pageBaseIndex: number;
}

/**
 * DataTableBody - 数据行渲染
 *
 * 三态优先级：error > loading > empty > data。
 * 行选择列渲染 RowCheckbox，展开列渲染 RowExpander，展开行追加详情子行。
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
	filtered = false,
	emptyTitle,
	emptyDescription,
	selectable,
	selectedIds,
	onToggleRow,
	expandable,
	expandedRowKeys,
	onToggleExpand,
	renderExpandedRow,
	onRowClick,
	pageBaseIndex,
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
								title="ERROR"
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
		const title = filtered ? "NO_MATCH" : (emptyTitle ?? "NO_DATA");
		const desc = filtered ? "未找到匹配结果，请调整筛选条件" : (emptyDescription ?? "暂无数据");
		return (
			<TableBody>
				<TableRow className="hover:bg-transparent">
					<TableCell colSpan={colCount} className="p-0">
						<div className="py-12" aria-live="polite">
							<Empty title={title} description={desc} size="sm" />
						</div>
					</TableCell>
				</TableRow>
			</TableBody>
		);
	}

	return (
		<TableBody>
			{data.map((row, index) => {
				const rowKey = keyExtractor(row);
				const isSelected = selectable && selectedIds.has(rowKey);
				const isExpanded = expandable && expandedRowKeys.has(rowKey);
				return (
					<Fragment key={rowKey}>
						<TableRow
							data-state={isSelected ? "selected" : undefined}
							aria-selected={selectable ? isSelected : undefined}
							aria-rowindex={pageBaseIndex + index + 1}
							onClick={onRowClick ? () => onRowClick(row) : undefined}
							className={onRowClick ? "cursor-pointer" : undefined}
						>
							{columns.map((col) => {
								const offset = offsets.get(col.key);
								const sticky = cellStickyStyle(offset);

								// 选择列：行 checkbox + 右内边距与下一列分隔
								if (col.key === SELECT_COLUMN_KEY) {
									return (
										<TableCell
											key={col.key}
											style={mergeStickyStyle(offset, col.width)}
											className={cn(cellPad, "pr-3", sticky.className, col.className)}
											onClick={(e) => e.stopPropagation()}
										>
											{selectable && (
												<RowCheckbox
													selected={isSelected}
													onToggle={() => onToggleRow(rowKey)}
													rowNumber={pageBaseIndex + index + 1}
												/>
											)}
										</TableCell>
									);
								}

								// 展开列：行展开切换按钮
								if (col.key === EXPAND_COLUMN_KEY) {
									return (
										<TableCell
											key={col.key}
											style={mergeStickyStyle(offset, col.width)}
											className={cn(cellPad, "pr-3", sticky.className, col.className)}
											onClick={(e) => e.stopPropagation()}
										>
											{expandable && (
												<RowExpander
													expanded={isExpanded}
													onToggle={() => onToggleExpand(rowKey)}
												/>
											)}
										</TableCell>
									);
								}

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
						{isExpanded && renderExpandedRow && (
							<TableRow className="hover:bg-transparent">
								<TableCell colSpan={colCount} className="bg-muted/30 p-4">
									{renderExpandedRow(row)}
								</TableCell>
							</TableRow>
						)}
					</Fragment>
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
