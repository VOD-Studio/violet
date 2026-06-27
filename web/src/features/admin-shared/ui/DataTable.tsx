import { useEffect, useMemo, useState } from "react";
import { cn } from "@/shared/lib/utils";
import { Table } from "@/shared/ui/table";
import { BulkActionBar } from "./BulkActionBar";
import { DataTableBody } from "./DataTableBody";
import { DataTableFooter } from "./DataTableFooter";
import { DataTableHeader } from "./DataTableHeader";
import { DataTableToolbar } from "./DataTableToolbar";
import { type DataTableColumn, type DataTableProps, SELECT_COLUMN_KEY } from "./data-table-types";
import { computeStickyOffsets } from "./sticky-utils";

/**
 * DataTable - 通用数据表格
 *
 * 组合工具栏、表格、分页；管理列可见性与行选择状态。
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

	// —— 可见列（含注入的选择列） ——
	const baseVisible = useMemo(
		() => columns.filter((c) => !hiddenKeys.has(c.key)),
		[columns, hiddenKeys],
	);
	const visibleColumns = useMemo<DataTableColumn<T>[]>(() => {
		if (!selectable) return baseVisible;
		return [
			{
				key: SELECT_COLUMN_KEY,
				header: null,
				sticky: "left",
				width: "48px",
				hideable: false,
				sortable: false,
				align: "center",
			},
			...baseVisible,
		];
	}, [baseVisible, selectable]);
	const offsets = useMemo(() => computeStickyOffsets(visibleColumns), [visibleColumns]);

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
				className={cn(
					"overflow-auto rounded-md border border-border bg-card",
					stickyHeader && "supports-[backdrop-filter]:",
				)}
				style={stickyHeader ? { maxHeight } : undefined}
				aria-busy={loading ? true : undefined}
			>
				<Table>
					{caption ? <caption className="sr-only">{caption}</caption> : null}
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
						pageBaseIndex={(page - 1) * pageSize}
					/>
				</Table>
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
