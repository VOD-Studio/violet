import { useEffect, useMemo, useState } from "react";
import { cn } from "@/shared/lib/utils";
import { BulkActionBar } from "./BulkActionBar";
import { DataTableBody } from "./DataTableBody";
import { DataTableFooter } from "./DataTableFooter";
import { DataTableHeader } from "./DataTableHeader";
import { DataTableToolbar } from "./DataTableToolbar";
import {
	type DataTableColumn,
	type DataTableProps,
	EXPAND_COLUMN_KEY,
	SELECT_COLUMN_KEY,
} from "./data-table-types";
import { computeStickyOffsets } from "./sticky-utils";

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
	expandedRowKeys,
	onExpandedChange,
	renderExpandedRow,
	onRowClick,
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

	function toggleColumn(key: string) {
		setHiddenKeys((prev) => {
			const next = new Set(prev);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	}

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

	function toggleSelectAll() {
		const next = new Set(selected);
		if (allSelected || someSelected) {
			for (const id of pageIds) next.delete(id);
		} else {
			for (const id of pageIds) next.add(id);
		}
		setSelected(next);
	}

	function toggleRow(id: string) {
		const next = new Set(selected);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		setSelected(next);
	}

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

	function resizeColumn(key: string, width: number) {
		setColumnWidths((prev) => ({ ...prev, [key]: width }));
	}

	// —— 行展开状态 ——
	const [internalExpanded, setInternalExpanded] = useState<Set<string>>(new Set());
	const expanded = expandedRowKeys ?? internalExpanded;
	const setExpanded = (next: Set<string>) => {
		setInternalExpanded(next);
		onExpandedChange?.(next);
	};
	function toggleExpand(id: string) {
		const next = new Set(expanded);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		setExpanded(next);
	}

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
		return [...injected, ...baseVisible];
	}, [baseVisible, selectable, expandable]);
	const offsets = useMemo(() => computeStickyOffsets(visibleColumns), [visibleColumns]);

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

	return (
		<div className={cn("w-full space-y-0", className)}>
			<DataTableToolbar
				toolbar={toolbar}
				columns={columns}
				hiddenKeys={hiddenKeys}
				onToggleColumn={toggleColumn}
				onResetColumns={() => setHiddenKeys(new Set())}
				selectedCount={selectable ? selected.size : 0}
			/>

			<div
				className="border-border bg-card overflow-auto rounded-md border"
				style={stickyHeader ? { maxHeight } : undefined}
				aria-busy={loading ? true : undefined}
			>
				<table
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
							const w = columnWidthMap.get(col.key);
							return <col key={col.key} style={w ? { width: `${w}px` } : undefined} />;
						})}
					</colgroup>
					<DataTableHeader
						columns={visibleColumns}
						offsets={offsets}
						stickyHeader={stickyHeader}
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
					/>
					<DataTableBody
						columns={visibleColumns}
						data={data}
						keyExtractor={keyExtractor}
						offsets={offsets}
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
						expandedRowKeys={expanded}
						onToggleExpand={toggleExpand}
						renderExpandedRow={renderExpandedRow}
						onRowClick={onRowClick}
						pageBaseIndex={(page - 1) * pageSize}
					/>
				</table>
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
