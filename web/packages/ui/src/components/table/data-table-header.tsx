"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { Checkbox } from "../checkbox";
import { ColumnMenu } from "./column-menu";
import { ColumnResizer } from "./column-resizer";
import type { DataTableColumn, DataTableSort } from "./data-table-types";
import { COLUMNS_CONTROL_KEY, EXPAND_COLUMN_KEY, SELECT_COLUMN_KEY } from "./data-table-types";
import { type StickyOffset, stickyProps } from "./sticky-utils";
import { TableHead, TableHeader, TableRow } from "./table";

/** 「显示列」按钮所需的数据；没有时表头左上角不出现按钮。 */
export interface HeaderColumnControl<T> {
	columns: DataTableColumn<T>[];
	hiddenKeys: Set<string>;
	onToggle: (key: string) => void;
	canReset: boolean;
	onReset: () => void;
}

interface DataTableHeaderProps<T> {
	columns: DataTableColumn<T>[];
	offsets: Map<string, StickyOffset>;
	sort?: DataTableSort | null;
	onSortChange?: (sort: DataTableSort) => void;
	allSelected: boolean;
	someSelected: boolean;
	onToggleSelectAll: () => void;
	resizable: boolean;
	columnMinWidth: number;
	onResizeColumn: (key: string, width: number) => void;
	columnControl?: HeaderColumnControl<T>;
	container?: HTMLElement | null;
}

function ariaSortOf(
	column: { key: string; sortable?: boolean },
	sort: DataTableSort | null | undefined,
): "none" | "ascending" | "descending" | undefined {
	if (!column.sortable) return undefined;
	if (sort?.key !== column.key) return "none";
	return sort.order === "asc" ? "ascending" : "descending";
}

/** 表头行：排序按钮、全选本页、固定列、列宽手柄，以及左上角的「显示列」。 */
export function DataTableHeader<T>({
	columns,
	offsets,
	sort,
	onSortChange,
	allSelected,
	someSelected,
	onToggleSelectAll,
	resizable,
	columnMinWidth,
	onResizeColumn,
	columnControl,
	container,
}: DataTableHeaderProps<T>) {
	const control = columnControl ? (
		<ColumnMenu
			columns={columnControl.columns}
			hiddenKeys={columnControl.hiddenKeys}
			onToggle={columnControl.onToggle}
			canReset={columnControl.canReset}
			onReset={columnControl.onReset}
			container={container}
		/>
	) : null;

	return (
		<TableHeader>
			<TableRow>
				{columns.map((col, index) => {
					const offset = offsets.get(col.key);
					const sticky = stickyProps(offset);

					if (col.key === SELECT_COLUMN_KEY) {
						return (
							<TableHead
								key={col.key}
								scope="col"
								aria-colindex={index + 1}
								data-gutter=""
								{...sticky}
							>
								<Checkbox
									data-select-all=""
									aria-label="全选本页"
									checked={
										allSelected ? true : someSelected ? "indeterminate" : false
									}
									onCheckedChange={onToggleSelectAll}
								/>
							</TableHead>
						);
					}

					if (col.key === COLUMNS_CONTROL_KEY || col.key === EXPAND_COLUMN_KEY) {
						return (
							<TableHead
								key={col.key}
								scope="col"
								aria-colindex={index + 1}
								data-gutter=""
								{...sticky}
							>
								{control ??
									(col.key === EXPAND_COLUMN_KEY ? (
										<span className="v-table__sr">展开行</span>
									) : null)}
							</TableHead>
						);
					}

					const align = col.align ?? "left";
					const sorted = sort?.key === col.key;
					const nextIsRightSticky = columns[index + 1]?.sticky === "right";
					const showResizer =
						resizable &&
						col.resizable !== false &&
						offset?.side !== "right" &&
						!nextIsRightSticky;

					return (
						<TableHead
							key={col.key}
							scope="col"
							aria-sort={ariaSortOf(col, sort)}
							aria-colindex={index + 1}
							data-align={align}
							data-sorted={sorted ? "" : undefined}
							className={col.className}
							{...sticky}
						>
							{col.sortable ? (
								<button
									type="button"
									className="v-table__sort"
									onClick={() =>
										onSortChange?.({
											key: col.key,
											order: sorted && sort?.order === "asc" ? "desc" : "asc",
										})
									}
								>
									{col.header}
									{sorted ? (
										sort?.order === "asc" ? (
											<ArrowUp
												className="v-table__sort-icon"
												size={13}
												aria-hidden="true"
											/>
										) : (
											<ArrowDown
												className="v-table__sort-icon"
												size={13}
												aria-hidden="true"
											/>
										)
									) : (
										<ChevronsUpDown
											className="v-table__sort-icon"
											data-idle=""
											size={13}
											aria-hidden="true"
										/>
									)}
								</button>
							) : (
								col.header
							)}
							{showResizer ? (
								<ColumnResizer
									minWidth={columnMinWidth}
									onResize={(width) => onResizeColumn(col.key, width)}
								/>
							) : null}
						</TableHead>
					);
				})}
			</TableRow>
		</TableHeader>
	);
}
