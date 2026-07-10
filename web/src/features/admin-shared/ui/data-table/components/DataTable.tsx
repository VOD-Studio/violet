import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/shared/lib/utils";
import { OverlayScroll } from "@/shared/ui/overlay-scroll";
import {
    COLUMNS_CONTROL_KEY,
    type DataTableColumn,
    type DataTableProps,
    EXPAND_COLUMN_KEY,
    SELECT_COLUMN_KEY,
} from "../types/data-table-types";
import { computeStickyOffsets } from "../utils/sticky-utils";
import { BulkActionBar } from "./BulkActionBar";
import { DataTableBody } from "./DataTableBody";
import { DataTableFooter } from "./DataTableFooter";
import { DataTableHeader } from "./DataTableHeader";
import { DataTableToolbar } from "./DataTableToolbar";
import "../styles/sticky-shadow.css";

const DEFAULT_COLUMN_MIN_WIDTH = 80;

/**
 * DataTable - 通用数据表格
 *
 * 组合工具栏、表格、分页；管理列可见性、列宽与行选择/展开状态。
 * 分页、排序由调用方受控。
 */
export function DataTable<T>({
    columns,
    data,
    keyExtractor,
    page,
    pageSize,
    total,
    onPageChange,
    pageSizeOptions,
    onPageSizeChange,
    sort,
    onSortChange,
    loading,
    error,
    onRetry,
    selectable = false,
    selectedIds,
    onSelectionChange,
    bulkActions,
    expandable = false,
    expandedRowFixed = false,
    expandedRowKeys,
    onExpandedChange,
    renderExpandedRow,
    onRowClick,
    rowClassName,
    resizable = false,
    columnMinWidth = DEFAULT_COLUMN_MIN_WIDTH,
    toolbar,
    storageKey,
    filtered = false,
    density = "comfortable",
    stickyHeader = false,
    maxHeight = "60vh",
    caption,
    emptyTitle,
    emptyDescription,
    className,
}: DataTableProps<T>) {
    // —— 列可见性状态 ——
    const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(() => {
        if (!storageKey) return new Set();
        try {
            const raw = localStorage.getItem(storageKey);
            if (!raw) return new Set();
            return new Set(JSON.parse(raw) as string[]);
        } catch {
            return new Set();
        }
    });

    useEffect(() => {
        if (!storageKey) return;
        try {
            localStorage.setItem(storageKey, JSON.stringify([...hiddenKeys]));
        } catch {
            /* 忽略：localStorage 写入失败不影响功能 */
        }
    }, [hiddenKeys, storageKey]);

    const toggleColumn = (key: string) => {
        setHiddenKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    // —— 行选择状态（受控优先，否则内部自管；均跨页保持） ——
    const [internalSelected, setInternalSelected] = useState<Set<string>>(new Set());
    const selected = selectedIds ?? internalSelected;
    const setSelected = (next: Set<string>) => {
        setInternalSelected(next);
        onSelectionChange?.(next);
    };

    const pageIds = useMemo(() => data.map(keyExtractor), [data, keyExtractor]);
    const selectedOnPage = pageIds.filter((id) => selected.has(id));
    const allSelected = pageIds.length > 0 && selectedOnPage.length === pageIds.length;
    const someSelected = selectedOnPage.length > 0 && !allSelected;

    const toggleSelectAll = () => {
        const next = new Set(selected);
        if (allSelected || someSelected) {
            for (const id of pageIds) next.delete(id);
        } else {
            for (const id of pageIds) next.add(id);
        }
        setSelected(next);
    };

    const toggleRow = (id: string) => {
        const next = new Set(selected);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelected(next);
    };

    // —— 列宽状态（localStorage 持久化） ——
    const widthStorageKey = storageKey ? `${storageKey}-widths` : undefined;
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
        if (!widthStorageKey) return {};
        try {
            const raw = localStorage.getItem(widthStorageKey);
            if (!raw) return {};
            return JSON.parse(raw) as Record<string, number>;
        } catch {
            return {};
        }
    });

    useEffect(() => {
        if (!widthStorageKey) return;
        try {
            localStorage.setItem(widthStorageKey, JSON.stringify(columnWidths));
        } catch {
            /* 忽略 */
        }
    }, [columnWidths, widthStorageKey]);

    const resizeColumn = (key: string, width: number) => {
        setColumnWidths((prev) => ({ ...prev, [key]: width }));
        // 拖拽后延迟检测滚动状态，因为 DOM 需要时间更新
        setTimeout(() => {
            checkScroll();
        }, 0);
    };

    // —— 行展开状态 ——
    const [internalExpanded, setInternalExpanded] = useState<Set<string>>(new Set());
    const expanded = expandedRowKeys ?? internalExpanded;
    const setExpanded = (next: Set<string>) => {
        setInternalExpanded(next);
        onExpandedChange?.(next);
    };
    const toggleExpand = (id: string) => {
        const next = new Set(expanded);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpanded(next);
    };

    // —— 可见列（含注入的选择列 / 展开列） ——
    const baseVisible = useMemo(
        () => columns.filter((c) => !hiddenKeys.has(c.key)),
        [columns, hiddenKeys],
    );
    const visibleColumns = useMemo<DataTableColumn<T>[]>(() => {
        const injected: DataTableColumn<T>[] = [];
        if (expandable) {
            injected.push({
                key: EXPAND_COLUMN_KEY,
                header: null,
                sticky: "left",
                width: "48px",
                hideable: false,
                sortable: false,
                align: "center",
            });
        }
        if (selectable) {
            injected.push({
                key: SELECT_COLUMN_KEY,
                header: null,
                sticky: "left",
                width: "48px",
                hideable: false,
                sortable: false,
                align: "center",
            });
        }
        // 列控制按钮列：有可隐藏列且启用了 storageKey 时才注入
        const hasHideable = columns.some((c) => c.hideable !== false);
        const tail: DataTableColumn<T>[] =
            storageKey && hasHideable
                ? [
                      {
                          key: COLUMNS_CONTROL_KEY,
                          header: null,
                          sticky: "right",
                          width: "40px",
                          hideable: false,
                          sortable: false,
                          align: "center",
                      },
                  ]
                : [];
        return [...injected, ...baseVisible, ...tail];
    }, [baseVisible, selectable, expandable, columns, storageKey]);

    // 每列实际宽度（含拖拽结果），供 colgroup 使用
    const columnWidthMap = useMemo(() => {
        const map = new Map<string, number>();
        for (const col of visibleColumns) {
            const fromStore = columnWidths[col.key];
            if (fromStore != null) {
                map.set(col.key, fromStore);
            } else {
                const matched = col.width?.match(/^(\d+(?:\.\d+)?)px$/);
                map.set(col.key, matched ? Number(matched[1]) : 0);
            }
        }
        return map;
    }, [visibleColumns, columnWidths]);

    // colgroup 使用的 CSS 宽度字符串：拖拽结果转 px，否则用列定义的原始 width
    const colgroupWidthMap = useMemo(() => {
        const map = new Map<string, string>();
        for (const col of visibleColumns) {
            const fromStore = columnWidths[col.key];
            if (fromStore != null) {
                map.set(col.key, `${fromStore}px`);
            } else if (col.width) {
                map.set(col.key, col.width);
            }
        }
        return map;
    }, [visibleColumns, columnWidths]);

    const offsets = useMemo(
        () => computeStickyOffsets(visibleColumns, columnWidthMap),
        [visibleColumns, columnWidthMap],
    );

    // 所有列宽度之和（无显式宽度的列给 120px 基准），作为 table min-width
    // 防止容器变窄时列被挤压成一线，改为触发横向滚动
    const totalColumnWidth = useMemo(() => {
        let sum = 0;
        for (const col of visibleColumns) {
            sum += columnWidthMap.get(col.key) || 120;
        }
        return sum;
    }, [visibleColumns, columnWidthMap]);

    const showFooter = total > 0;
    const showBulkBar = bulkActions != null && selected.size > 0;

    // —— 首次渲染后，从 DOM 读取所有列的实际宽度 ——
    const tableRef = useRef<HTMLTableElement>(null);
    const headerScrollRef = useRef<HTMLDivElement>(null);
    const hasInitializedWidths = useRef(false);

    useEffect(() => {
        if (hasInitializedWidths.current || !tableRef.current) return;

        // 读取所有 th 的实际宽度
        const ths = tableRef.current.querySelectorAll("thead th");
        const initialWidths: Record<string, number> = {};
        let hasAnyWidth = false;

        ths.forEach((th, index) => {
            const col = visibleColumns[index];
            if (!col) return;

            // 如果已经有存储的宽度，跳过
            if (columnWidths[col.key] != null) return;

            const width = th.getBoundingClientRect().width;
            if (width > 0) {
                initialWidths[col.key] = Math.round(width);
                hasAnyWidth = true;
            }
        });

        if (hasAnyWidth) {
            setColumnWidths((prev) => ({ ...prev, ...initialWidths }));
            hasInitializedWidths.current = true;
        }
    }, [visibleColumns, columnWidths]);

    // —— 滚动状态检测：控制固定列阴影显示 ——
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [scrollState, setScrollState] = useState({
        isScrolledLeft: false, // 已向左滚动（显示左侧阴影）
        isScrolledRight: false, // 已向右滚动（显示右侧阴影）
    });
    const [containerWidth, setContainerWidth] = useState(0);

    // 提取 checkScroll 函数，供拖拽后手动调用
    const checkScroll = useCallback(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        const { scrollLeft, scrollWidth, clientWidth } = container;
        setScrollState({
            isScrolledLeft: scrollLeft > 0,
            isScrolledRight: scrollLeft < scrollWidth - clientWidth - 1,
        });
    }, []);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        // 初始检测
        checkScroll();
        setContainerWidth(container.clientWidth);

        // 监听滚动
        container.addEventListener("scroll", checkScroll);
        // 监听窗口大小变化（可能影响是否需要滚动）
        window.addEventListener("resize", checkScroll);

        // 监听容器尺寸变化（侧边栏折叠、列宽拖拽等）
        const ro = new ResizeObserver(() => {
            setContainerWidth(container.clientWidth);
            checkScroll();
        });
        ro.observe(container);

        return () => {
            container.removeEventListener("scroll", checkScroll);
            window.removeEventListener("resize", checkScroll);
            ro.disconnect();
        };
    }, [checkScroll]);

    // 计算带滚动状态的 offsets
    const offsetsWithScroll = useMemo(() => {
        const map = new Map(offsets);
        for (const [key, offset] of map) {
            // 左侧固定列：只在向左滚动时显示阴影
            if (offset.side === "left" && offset.isLast) {
                map.set(key, { ...offset, showShadow: scrollState.isScrolledLeft });
            }
            // 右侧固定列：只在向右滚动时显示阴影
            if (offset.side === "right" && offset.isLast) {
                map.set(key, { ...offset, showShadow: scrollState.isScrolledRight });
            }
        }
        return map;
    }, [offsets, scrollState]);

    // —— header / body 横向滚动同步 ——
    // body 滚动时同步 header 的 scrollLeft（header 容器 overflow-hidden，靠 JS 驱动）
    // OverlayScroll 隐藏原生滚动条不占空间，header/body 天然等宽无需补偿
    useEffect(() => {
        const body = scrollContainerRef.current;
        const header = headerScrollRef.current;
        if (!body || !header) return;

        const syncScroll = () => {
            header.scrollLeft = body.scrollLeft;
        };

        body.addEventListener("scroll", syncScroll);
        syncScroll();

        return () => {
            body.removeEventListener("scroll", syncScroll);
        };
    }, []);

    return (
        <div className={cn("w-full space-y-0", className)}>
            <DataTableToolbar toolbar={toolbar} selectedCount={selectable ? selected.size : 0} />

            <div className="border-border bg-card overflow-hidden rounded-md border">
                {/* Header — 独立容器，无滚动条；table 宽度由 JS 同步为 body clientWidth */}
                <div ref={headerScrollRef} className="overflow-hidden">
                    <table
                        ref={tableRef}
                        className="caption-bottom text-sm"
                        style={{
                            tableLayout: "fixed",
                            width: "100%",
                            minWidth: `${totalColumnWidth}px`,
                        }}
                    >
                        {caption ? <caption className="sr-only">{caption}</caption> : null}
                        <colgroup>
                            {visibleColumns.map((col) => {
                                const w = colgroupWidthMap.get(col.key);
                                return <col key={col.key} style={w ? { width: w } : undefined} />;
                            })}
                        </colgroup>
                        <DataTableHeader
                            columns={visibleColumns}
                            offsets={offsetsWithScroll}
                            stickyHeader={false}
                            sort={sort}
                            onSortChange={onSortChange}
                            density={density}
                            selectable={selectable}
                            allSelected={allSelected}
                            someSelected={someSelected}
                            onToggleSelectAll={toggleSelectAll}
                            resizable={resizable}
                            columnMinWidth={columnMinWidth}
                            columnWidthMap={columnWidthMap}
                            onResizeColumn={resizeColumn}
                            // 列控制
                            allColumns={columns}
                            hiddenKeys={hiddenKeys}
                            onToggleColumn={toggleColumn}
                            onResetColumns={() => {
                                setHiddenKeys(new Set());
                                setColumnWidths({});
                                if (widthStorageKey) {
                                    localStorage.removeItem(widthStorageKey);
                                }
                            }}
                        />
                    </table>
                </div>
                {/* Body — OverlayScroll 自定义滚动条，不占据布局空间 */}
                <OverlayScroll
                    ref={scrollContainerRef}
                    style={stickyHeader ? { maxHeight } : undefined}
                    aria-busy={loading ? true : undefined}
                >
                    <table
                        className="text-sm"
                        style={{
                            tableLayout: "fixed",
                            width: "100%",
                            minWidth: `${totalColumnWidth}px`,
                        }}
                    >
                        <colgroup>
                            {visibleColumns.map((col) => {
                                const w = colgroupWidthMap.get(col.key);
                                return <col key={col.key} style={w ? { width: w } : undefined} />;
                            })}
                        </colgroup>
                        <DataTableBody
                            columns={visibleColumns}
                            data={data}
                            keyExtractor={keyExtractor}
                            offsets={offsetsWithScroll}
                            loading={loading}
                            error={error}
                            onRetry={onRetry}
                            density={density}
                            filtered={filtered}
                            emptyTitle={emptyTitle}
                            emptyDescription={emptyDescription}
                            selectable={selectable}
                            selectedIds={selected}
                            onToggleRow={toggleRow}
                            expandable={expandable}
                            expandedRowFixed={expandedRowFixed}
                            containerWidth={containerWidth}
                            expandedRowKeys={expanded}
                            onToggleExpand={toggleExpand}
                            renderExpandedRow={renderExpandedRow}
                            onRowClick={onRowClick}
                            rowClassName={rowClassName}
                            pageBaseIndex={(page - 1) * pageSize}
                        />
                    </table>
                </OverlayScroll>
            </div>

            {showFooter && (
                <DataTableFooter
                    page={page}
                    pageSize={pageSize}
                    total={total}
                    onPageChange={onPageChange}
                    pageSizeOptions={pageSizeOptions}
                    onPageSizeChange={onPageSizeChange}
                />
            )}

            {showBulkBar && (
                <BulkActionBar selectedCount={selected.size} onClear={() => setSelected(new Set())}>
                    {bulkActions}
                </BulkActionBar>
            )}
        </div>
    );
}
