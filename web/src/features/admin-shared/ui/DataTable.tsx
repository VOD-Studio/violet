import { useEffect, useMemo, useState } from "react";
import { cn } from "@/shared/lib/utils";
import { Table } from "@/shared/ui/table";
import { DataTableBody } from "./DataTableBody";
import { DataTableFooter } from "./DataTableFooter";
import { DataTableHeader } from "./DataTableHeader";
import { DataTableToolbar } from "./DataTableToolbar";
import type { DataTableProps } from "./data-table-types";
import { computeStickyOffsets } from "./sticky-utils";

/**
 * DataTable - 通用数据表格（自研，纯服务端分页/排序）
 *
 * 组装工具栏 + 表格 + 分页，收口列可见性状态（localStorage 持久化）。
 * 固定列偏移按可见列实时计算，隐藏列后偏移自动重算。
 * 三态优先级：error > loading > empty > data。
 * 全语义色 token，shadcn 克制风，零硬编码色。
 */
export function DataTable<T>({
	columns,
	data,
	keyExtractor,
	page,
	pageSize,
	total,
	onPageChange,
	sort,
	onSortChange,
	loading,
	error,
	onRetry,
	toolbar,
	storageKey,
	density = "comfortable",
	stickyHeader = false,
	maxHeight = "60vh",
	caption,
	emptyTitle,
	emptyDescription,
	className,
}: DataTableProps<T>) {
	// —— 列可见性状态（localStorage 持久化） ——
	const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(() => {
		if (!storageKey) return new Set();
		try {
			const raw = localStorage.getItem(storageKey);
			if (!raw) return new Set();
			const arr = JSON.parse(raw) as string[];
			return new Set(arr);
		} catch {
			return new Set();
		}
	});

	useEffect(() => {
		if (!storageKey) return;
		try {
			localStorage.setItem(storageKey, JSON.stringify([...hiddenKeys]));
		} catch {
			// localStorage 不可用（隐私模式等）静默忽略
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

	function resetColumns() {
		setHiddenKeys(new Set());
	}

	// —— 按可见性过滤列，并据此计算固定列偏移 ——
	const visibleColumns = useMemo(
		() => columns.filter((c) => !hiddenKeys.has(c.key)),
		[columns, hiddenKeys],
	);
	const offsets = useMemo(() => computeStickyOffsets(visibleColumns), [visibleColumns]);

	const hasFooter = total > 0;

	return (
		<div className={cn("w-full space-y-0", className)}>
			<DataTableToolbar
				toolbar={toolbar}
				columns={columns}
				hiddenKeys={hiddenKeys}
				onToggleColumn={toggleColumn}
				onResetColumns={resetColumns}
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
						emptyTitle={emptyTitle}
						emptyDescription={emptyDescription}
					/>
				</Table>
			</div>

			{hasFooter && (
				<DataTableFooter
					page={page}
					pageSize={pageSize}
					total={total}
					onPageChange={onPageChange}
				/>
			)}
		</div>
	);
}
