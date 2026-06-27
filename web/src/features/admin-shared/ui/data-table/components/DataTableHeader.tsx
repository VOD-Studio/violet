import { cn } from "@/shared/lib/utils";
import { TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { ColumnResizer } from "./ColumnResizer";
import type { DataTableColumn, DataTableSort } from "../types/data-table-types";
import { EXPAND_COLUMN_KEY, SELECT_COLUMN_KEY } from "../types/data-table-types";
import { SelectAllCheckbox } from "./SelectAllCheckbox";
import { SortIcon } from "./SortIcon";
import { headStickyStyle, mergeStickyStyle, type StickyOffset } from "../utils/sticky-utils";

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
    resizable: boolean;
    columnMinWidth: number;
    columnWidthMap: Map<string, number>;
    onResizeColumn: (key: string, width: number) => void;
}

/**
 * DataTableHeader - 表头行
 *
 * 渲染排序列（含 aria-sort）、固定列/吸顶 sticky 样式、注入的选择列
 * （全选当前页）与展开列，以及可选的列宽拖拽手柄。
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
    resizable,
    columnMinWidth,
    columnWidthMap,
    onResizeColumn,
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

                    // 选择列表头：全选 checkbox + 右内边距与下一列分隔
                    if (col.key === SELECT_COLUMN_KEY) {
                        return (
                            <TableHead
                                key={col.key}
                                scope="col"
                                style={mergeStickyStyle(offset, col.width)}
                                className={cn(headHeight, "pr-3", sticky.className, col.className)}
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

                    // 展开列表头：占位
                    if (col.key === EXPAND_COLUMN_KEY) {
                        return (
                            <TableHead
                                key={col.key}
                                scope="col"
                                style={mergeStickyStyle(offset, col.width)}
                                className={cn(headHeight, "pr-3", sticky.className, col.className)}
                            />
                        );
                    }

                    let ariaSort: "none" | "ascending" | "descending" | undefined;
                    if (col.sortable) {
                        ariaSort = isActive
                            ? sort?.order === "asc"
                                ? "ascending"
                                : "descending"
                            : "none";
                    }

                    // 检查下一列是否是右固定列
                    const nextCol = columns[index + 1];
                    const nextIsRightSticky = nextCol?.sticky === "right";

                    // 右侧固定列不显示拖拽手柄（因为固定在最右侧，调整宽度无意义）
                    // 右侧固定列左侧的列也不显示拖拽手柄（避免影响右固定列的位置）
                    const showResizer =
                        resizable &&
                        col.resizable !== false &&
                        offset?.side !== "right" &&
                        !nextIsRightSticky;

                    return (
                        <TableHead
                            key={col.key}
                            scope="col"
                            aria-sort={ariaSort}
                            aria-colindex={index + 1}
                            style={mergeStickyStyle(offset, col.width)}
                            className={cn(
                                headHeight,
                                showResizer && "relative",
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
                                    <SortIcon
                                        active={isActive}
                                        order={isActive ? sort?.order : undefined}
                                    />
                                </button>
                            ) : (
                                col.header
                            )}
                            {showResizer && (
                                <ColumnResizer
                                    width={columnWidthMap.get(col.key) ?? 0}
                                    minWidth={columnMinWidth}
                                    onResize={(w) => onResizeColumn(col.key, w)}
                                />
                            )}
                        </TableHead>
                    );
                })}
            </TableRow>
        </TableHeader>
    );
}
