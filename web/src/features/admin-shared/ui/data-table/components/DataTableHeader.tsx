import { Columns3, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/base/button";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/shared/ui/base/dropdown-menu";
import { TableHead, TableHeader, TableRow } from "@/shared/ui/base/table";
import type { DataTableColumn, DataTableSort } from "../types/data-table-types";
import {
    COLUMNS_CONTROL_KEY,
    EXPAND_COLUMN_KEY,
    SELECT_COLUMN_KEY,
} from "../types/data-table-types";
import { headStickyStyle, mergeStickyStyle, type StickyOffset } from "../utils/sticky-utils";
import { ColumnResizer } from "./ColumnResizer";
import { SelectAllCheckbox } from "./SelectAllCheckbox";
import { SortIcon } from "./SortIcon";

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
    // 列控制
    allColumns?: DataTableColumn<T>[];
    hiddenKeys?: Set<string>;
    onToggleColumn?: (key: string) => void;
    onResetColumns?: () => void;
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
    allColumns,
    hiddenKeys,
    onToggleColumn,
    onResetColumns,
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

                    // 列控制按钮列：表头末尾的 icon 按钮
                    if (col.key === COLUMNS_CONTROL_KEY) {
                        const hideableCols = (allColumns ?? []).filter((c) => c.hideable !== false);
                        const anyHidden = (hiddenKeys?.size ?? 0) > 0;
                        return (
                            <TableHead
                                key={col.key}
                                scope="col"
                                style={mergeStickyStyle(offset, col.width)}
                                className={cn(
                                    headHeight,
                                    "flex items-center justify-center",
                                    sticky.className,
                                )}
                            >
                                {hideableCols.length > 0 && onToggleColumn && (
                                    <ColumnControlButton
                                        hideableColumns={hideableCols}
                                        hiddenKeys={hiddenKeys ?? new Set()}
                                        onToggleColumn={onToggleColumn}
                                        onResetColumns={onResetColumns}
                                        anyHidden={anyHidden}
                                    />
                                )}
                            </TableHead>
                        );
                    }

                    // 展开列表头：有列控制时渲染按钮，否则空占位
                    if (col.key === EXPAND_COLUMN_KEY) {
                        const hideableCols = (allColumns ?? []).filter((c) => c.hideable !== false);
                        const showControl = hideableCols.length > 0 && onToggleColumn;
                        const anyHidden = (hiddenKeys?.size ?? 0) > 0;
                        return (
                            <TableHead
                                key={col.key}
                                scope="col"
                                style={mergeStickyStyle(offset, col.width)}
                                className={cn(
                                    headHeight,
                                    "flex items-center justify-center",
                                    sticky.className,
                                    col.className,
                                )}
                            >
                                {showControl && (
                                    <ColumnControlButton
                                        hideableColumns={hideableCols}
                                        hiddenKeys={hiddenKeys ?? new Set()}
                                        onToggleColumn={onToggleColumn}
                                        onResetColumns={onResetColumns}
                                        anyHidden={anyHidden}
                                    />
                                )}
                            </TableHead>
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

/** 列控制按钮：icon-only，dropdown 显示/隐藏列 */
function ColumnControlButton<T>({
    hideableColumns,
    hiddenKeys,
    onToggleColumn,
    onResetColumns,
    anyHidden,
}: {
    hideableColumns: DataTableColumn<T>[];
    hiddenKeys: Set<string>;
    onToggleColumn: (key: string) => void;
    onResetColumns?: () => void;
    anyHidden: boolean;
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" title="显示列" className="size-7">
                    <Columns3 className="size-3.5" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel className="flex items-center justify-between">
                    <span>显示列</span>
                    {anyHidden && onResetColumns && (
                        <button
                            type="button"
                            onClick={onResetColumns}
                            className="text-muted-foreground hover:text-foreground"
                            title="重置"
                        >
                            <RotateCcw className="size-3.5" />
                        </button>
                    )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {hideableColumns.map((col) => (
                    <DropdownMenuCheckboxItem
                        key={col.key}
                        checked={!hiddenKeys.has(col.key)}
                        onSelect={(e) => e.preventDefault()}
                        onCheckedChange={() => onToggleColumn(col.key)}
                    >
                        {labelOf(col.header)}
                    </DropdownMenuCheckboxItem>
                ))}
                {anyHidden && onResetColumns && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={onResetColumns}>重置列</DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/** 从列 header 提取菜单显示文案：优先字符串，否则回退 key */
function labelOf(header: ReactNode): string {
    if (typeof header === "string") return header;
    return "列";
}
