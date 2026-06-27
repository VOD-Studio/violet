import { cn } from "@/shared/lib/utils";
import { TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import type { DataTableColumn, DataTableSort } from "./data-table-types";
import { SELECT_COLUMN_KEY } from "./data-table-types";
import { SelectAllCheckbox } from "./SelectAllCheckbox";
import { SortIcon } from "./SortIcon";
import { headStickyStyle, mergeStickyStyle, type StickyOffset } from "./sticky-utils";

const ALIGN_CLASS = {
	left: "text-left",
	center: "text-center",
	right: "text-right",
} as const;

interface DataTableHeaderProps<T> {
	columns: DataTableColumn<T>[];
	offsets: Map<string, StickyOffset>;
	stickyHeader?: boolean;
	sort?: DataTableSort | null;
	onSortChange?: (sort: DataTableSort) => void;
	density: "comfortable" | "compact";
	selectable: boolean;
	allSelected: boolean;
	someSelected: boolean;
	onToggleSelectAll: () => void;
}

/**
 * DataTableHeader - 表头行
 *
 * 渲染排序列（含 aria-sort）、固定列/吸顶 sticky 样式，
 * 以及注入的选择列表头（全选当前页）。
 */
export function DataTableHeader<T>({
	columns,
	offsets,
	stickyHeader,
	sort,
	onSortChange,
	density,
	selectable,
	allSelected,
	someSelected,
	onToggleSelectAll,
}: DataTableHeaderProps<T>) {
	const headHeight = density === "compact" ? "h-8" : "h-10";

	function emitSort(col: DataTableColumn<T>) {
		if (!onSortChange) return;
		const isActive = sort?.key === col.key;
		const order: DataTableSort["order"] = isActive && sort?.order === "asc" ? "desc" : "asc";
		onSortChange({ key: col.key, order });
	}

	return (
		<TableHeader>
			<TableRow className="hover:bg-transparent">
				{columns.map((col, index) => {
					const offset = offsets.get(col.key);
					const sticky = headStickyStyle(offset, stickyHeader);
					const isActive = sort?.key === col.key;
					const align = col.align ?? "left";

					// 选择列表头：渲染全选 checkbox
					if (col.key === SELECT_COLUMN_KEY) {
						return (
							<TableHead
								key={col.key}
								scope="col"
								style={mergeStickyStyle(offset, col.width)}
								className={cn(headHeight, sticky.className, col.className)}
							>
								{selectable && (
									<div className="flex justify-center">
										<SelectAllCheckbox
											allSelected={allSelected}
											someSelected={someSelected}
											onToggle={onToggleSelectAll}
										/>
									</div>
								)}
							</TableHead>
						);
					}

					let ariaSort: "none" | "ascending" | "descending" | undefined;
					if (col.sortable) {
						ariaSort = isActive ? (sort?.order === "asc" ? "ascending" : "descending") : "none";
					}

					return (
						<TableHead
							key={col.key}
							scope="col"
							aria-sort={ariaSort}
							aria-colindex={index + 1}
							style={mergeStickyStyle(offset, col.width)}
							className={cn(
								headHeight,
								"text-muted-foreground text-sm font-medium",
								ALIGN_CLASS[align],
								sticky.className,
								col.className,
							)}
						>
							{col.sortable ? (
								<button
									type="button"
									onClick={() => emitSort(col)}
									className={cn(
										"inline-flex w-full cursor-pointer items-center gap-1 select-none transition-colors hover:text-foreground",
										align === "right" && "flex-row-reverse",
										align === "center" && "justify-center",
									)}
								>
									<span>{col.header}</span>
									<SortIcon active={isActive} order={isActive ? sort?.order : undefined} />
								</button>
							) : (
								col.header
							)}
						</TableHead>
					);
				})}
			</TableRow>
		</TableHeader>
	);
}
