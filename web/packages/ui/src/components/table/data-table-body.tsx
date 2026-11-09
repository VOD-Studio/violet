"use client";

import { ChevronRight } from "lucide-react";
import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import { Button } from "../button";
import { Checkbox } from "../checkbox";
import { Skeleton } from "../skeleton";
import { TooltipProvider } from "../tooltip";
import { CellWithTooltip } from "./cell-with-tooltip";
import type { DataTableColumn, DataTableProps } from "./data-table-types";
import {
	COLUMNS_CONTROL_KEY,
	EXPAND_COLUMN_KEY,
	isFitContent,
	SELECT_COLUMN_KEY,
} from "./data-table-types";
import { type StickyOffset, stickyProps } from "./sticky-utils";
import { TableBody, TableCell, TableRow } from "./table";

/** 展开面板高度过渡时长，与 table.css 的 `--v-table-expand-duration` 一致 */
const EXPAND_DURATION = 280;
const SKELETON_ROWS = 4;
/** 骨架条宽度：标题列与其余列各自长短错开 */
const TITLE_SKELETON_WIDTHS = ["72%", "54%", "66%", "46%"];
const OTHER_SKELETON_WIDTHS = ["64%", "48%", "56%", "40%"];

type StateProps = Pick<
	DataTableProps<unknown>,
	| "errorTitle"
	| "emptyTitle"
	| "emptyDescription"
	| "emptyAction"
	| "filteredTitle"
	| "filteredDescription"
	| "filteredAction"
>;

interface DataTableBodyProps<T> extends StateProps {
	columns: DataTableColumn<T>[];
	data: T[];
	keyExtractor: (row: T) => string;
	offsets: Map<string, StickyOffset>;
	loading?: boolean;
	error?: Error | null;
	onRetry?: () => void;
	filtered: boolean;
	selectable: boolean;
	selectedIds: Set<string>;
	onToggleRow: (id: string) => void;
	expandable: boolean;
	expandedRowFixed: boolean;
	expandedRowKeys: Set<string>;
	onToggleExpand: (id: string) => void;
	renderExpandedRow?: (row: T) => ReactNode;
	onRowClick?: (row: T) => void;
	rowClassName?: (row: T) => string;
	/** 当前页首行在全集中的序号，用于全局 aria-rowindex */
	pageBaseIndex: number;
	container?: HTMLElement | null;
}

function prefersReducedMotion(scope: Element | null): boolean {
	return (
		scope?.closest('[data-motion="reduce"]') != null ||
		(typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches)
	);
}

/**
 * 展开面板的挂载与高度过渡：展开时先以收起态挂载再翻到展开态，收起时过渡结束后才卸载。
 * 面板只在展开期间挂载，`renderExpandedRow` 里的请求因此是懒触发的；减弱动态下直接挂载与卸载。
 */
function useCollapsePresence(expanded: boolean, scope: RefObject<Element | null>) {
	const [mounted, setMounted] = useState(expanded);
	const [open, setOpen] = useState(expanded);
	const mountedRef = useRef(mounted);
	mountedRef.current = mounted;

	useEffect(() => {
		if (expanded) {
			setMounted(true);
			if (prefersReducedMotion(scope.current)) {
				setOpen(true);
				return;
			}
			// 两帧：先让收起态落到屏幕上，翻到展开态才有过渡
			let inner = 0;
			const outer = requestAnimationFrame(() => {
				inner = requestAnimationFrame(() => setOpen(true));
			});
			return () => {
				cancelAnimationFrame(outer);
				cancelAnimationFrame(inner);
			};
		}
		if (!mountedRef.current) return;
		setOpen(false);
		if (prefersReducedMotion(scope.current)) {
			setMounted(false);
			return;
		}
		const timer = setTimeout(() => setMounted(false), EXPAND_DURATION + 20);
		return () => clearTimeout(timer);
	}, [expanded, scope]);

	return { mounted, open };
}

function renderCell<T>(col: DataTableColumn<T>, row: T): ReactNode {
	if (col.cell) return col.cell(row);
	if (col.accessorKey == null) return null;
	const value = row[col.accessorKey];
	if (value == null) return null;
	return typeof value === "string" || typeof value === "number" ? value : String(value);
}

interface DataRowProps<T> {
	row: T;
	columns: DataTableColumn<T>[];
	offsets: Map<string, StickyOffset>;
	rowKey: string;
	rowNumber: number;
	selectable: boolean;
	selected: boolean;
	expandable: boolean;
	expanded: boolean;
	expandedRowFixed: boolean;
	onToggleRow: (id: string) => void;
	onToggleExpand: (id: string) => void;
	renderExpandedRow?: (row: T) => ReactNode;
	onRowClick?: (row: T) => void;
	rowClassName?: (row: T) => string;
	container?: HTMLElement | null;
}

function DataRow<T>({
	row,
	columns,
	offsets,
	rowKey,
	rowNumber,
	selectable,
	selected,
	expandable,
	expanded,
	expandedRowFixed,
	onToggleRow,
	onToggleExpand,
	renderExpandedRow,
	onRowClick,
	rowClassName,
	container,
}: DataRowProps<T>) {
	const rowRef = useRef<HTMLTableRowElement>(null);
	const presence = useCollapsePresence(expandable && expanded, rowRef);
	const showPanel = expandable && renderExpandedRow != null && presence.mounted;
	const state = selected ? "selected" : undefined;

	return (
		<>
			<TableRow
				ref={rowRef}
				data-state={state}
				data-clickable={onRowClick ? "" : undefined}
				data-expanded={showPanel ? "" : undefined}
				aria-selected={selectable ? selected : undefined}
				aria-rowindex={rowNumber}
				onClick={onRowClick ? () => onRowClick(row) : undefined}
				className={rowClassName?.(row)}
			>
				{columns.map((col) => {
					const sticky = stickyProps(offsets.get(col.key));

					if (col.key === SELECT_COLUMN_KEY) {
						return (
							<TableCell
								key={col.key}
								data-gutter=""
								className={col.className}
								onClick={(event) => event.stopPropagation()}
								{...sticky}
							>
								{selectable ? (
									<Checkbox
										checked={selected}
										onCheckedChange={() => onToggleRow(rowKey)}
										aria-label={`选择第 ${rowNumber} 行`}
									/>
								) : null}
							</TableCell>
						);
					}

					if (col.key === EXPAND_COLUMN_KEY) {
						return (
							<TableCell
								key={col.key}
								data-gutter=""
								className={col.className}
								onClick={(event) => event.stopPropagation()}
								{...sticky}
							>
								{expandable ? (
									<button
										type="button"
										className="v-table__icon-button"
										aria-expanded={expanded}
										aria-label={expanded ? "收起" : "展开"}
										onClick={() => onToggleExpand(rowKey)}
									>
										<ChevronRight
											className="v-table__expand-icon"
											data-open={expanded ? "" : undefined}
											size={16}
											aria-hidden="true"
										/>
									</button>
								) : null}
							</TableCell>
						);
					}

					if (col.key === COLUMNS_CONTROL_KEY) {
						return <TableCell key={col.key} data-gutter="" {...sticky} />;
					}

					const content = renderCell(col, row);
					return (
						<TableCell
							key={col.key}
							data-align={col.align ?? "left"}
							className={col.className}
							onClick={
								col.stopClickPropagation
									? (event) => event.stopPropagation()
									: undefined
							}
							{...sticky}
						>
							<div
								className="v-table__cell-content"
								data-fit-content={isFitContent(col) ? col.key : undefined}
							>
								{col.ellipsis || col.tooltip ? (
									<CellWithTooltip
										ellipsis={col.ellipsis}
										tooltip={col.tooltip ? col.tooltip(row) : undefined}
										container={container}
									>
										{content}
									</CellWithTooltip>
								) : (
									content
								)}
							</div>
						</TableCell>
					);
				})}
			</TableRow>
			{showPanel ? (
				<TableRow
					className="v-table__expanded"
					data-state={state}
					data-open={presence.open ? "" : undefined}
				>
					<TableCell colSpan={columns.length} className="v-table__expanded-cell">
						<div
							className="v-table__collapse"
							data-open={presence.open ? "" : undefined}
						>
							<div className="v-table__collapse-inner">
								<div
									className="v-table__panel-wrap"
									data-fixed={expandedRowFixed ? "" : undefined}
								>
									<div className="v-table__panel">{renderExpandedRow(row)}</div>
								</div>
							</div>
						</div>
					</TableCell>
				</TableRow>
			) : null}
		</>
	);
}

interface StateRowProps {
	colSpan: number;
	kind: "error" | "empty" | "filtered";
	title: ReactNode;
	description?: ReactNode;
	action?: ReactNode;
}

/** 状态行：一个跨全部列的单元格，内容从标题列起左对齐——现状一句、原因或下一步一句、再一个按钮。 */
function StateRow({ colSpan, kind, title, description, action }: StateRowProps) {
	return (
		<TableBody>
			<TableRow className="v-table__state-row">
				<TableCell colSpan={colSpan} className="v-table__state-cell">
					<div
						className="v-data-table__state"
						data-kind={kind}
						role={kind === "error" ? "alert" : "status"}
					>
						<b className="v-data-table__state-title">
							{kind === "error" ? (
								<i className="v-data-table__state-dot" aria-hidden="true" />
							) : null}
							{title}
						</b>
						{description ? (
							<span
								className="v-data-table__state-text"
								data-mono={kind === "error" ? "" : undefined}
							>
								{description}
							</span>
						) : null}
						{action}
					</div>
				</TableCell>
			</TableRow>
		</TableBody>
	);
}

/** 表体，按「出错 > 加载中 > 空 > 数据」的优先级选一种呈现。 */
export function DataTableBody<T>({
	columns,
	data,
	keyExtractor,
	offsets,
	loading,
	error,
	onRetry,
	filtered,
	errorTitle = "没能读取数据",
	emptyTitle = "暂无数据",
	emptyDescription,
	emptyAction,
	filteredTitle = "没有匹配的结果",
	filteredDescription = "换个关键词，或者清除筛选",
	filteredAction,
	selectable,
	selectedIds,
	onToggleRow,
	expandable,
	expandedRowFixed,
	expandedRowKeys,
	onToggleExpand,
	renderExpandedRow,
	onRowClick,
	rowClassName,
	pageBaseIndex,
	container,
}: DataTableBodyProps<T>) {
	if (error) {
		return (
			<StateRow
				colSpan={columns.length}
				kind="error"
				title={errorTitle}
				description={error.message || "请稍后重试"}
				action={
					onRetry ? (
						<Button variant="secondary" size="sm" onClick={onRetry}>
							重试
						</Button>
					) : null
				}
			/>
		);
	}

	if (loading) {
		const firstDataIndex = columns.findIndex(
			(col) =>
				col.key !== SELECT_COLUMN_KEY &&
				col.key !== EXPAND_COLUMN_KEY &&
				col.key !== COLUMNS_CONTROL_KEY,
		);
		return (
			<TableBody>
				{Array.from({ length: SKELETON_ROWS }, (_, rowIndex) => (
					<TableRow key={rowIndex}>
						{columns.map((col, colIndex) => {
							const sticky = stickyProps(offsets.get(col.key));
							const injected = colIndex < firstDataIndex || firstDataIndex < 0;
							return (
								<TableCell
									key={col.key}
									data-align={injected ? "center" : (col.align ?? "left")}
									{...sticky}
								>
									{rowIndex === 0 && colIndex === 0 ? (
										<span role="status" className="v-table__sr">
											加载中
										</span>
									) : null}
									{injected ? null : (
										<div className="v-table__cell-content">
											<Skeleton
												className="v-table__skeleton"
												style={{
													inlineSize: (colIndex === firstDataIndex
														? TITLE_SKELETON_WIDTHS
														: OTHER_SKELETON_WIDTHS)[
														(rowIndex + colIndex) % SKELETON_ROWS
													],
												}}
											/>
										</div>
									)}
								</TableCell>
							);
						})}
					</TableRow>
				))}
			</TableBody>
		);
	}

	if (data.length === 0) {
		return filtered ? (
			<StateRow
				colSpan={columns.length}
				kind="filtered"
				title={filteredTitle}
				description={filteredDescription}
				action={filteredAction}
			/>
		) : (
			<StateRow
				colSpan={columns.length}
				kind="empty"
				title={emptyTitle}
				description={emptyDescription}
				action={emptyAction}
			/>
		);
	}

	return (
		<TooltipProvider>
			<TableBody>
				{data.map((row, index) => {
					const rowKey = keyExtractor(row);
					return (
						<DataRow
							key={rowKey}
							row={row}
							columns={columns}
							offsets={offsets}
							rowKey={rowKey}
							rowNumber={pageBaseIndex + index + 1}
							selectable={selectable}
							selected={selectable && selectedIds.has(rowKey)}
							expandable={expandable}
							expanded={expandedRowKeys.has(rowKey)}
							expandedRowFixed={expandedRowFixed}
							onToggleRow={onToggleRow}
							onToggleExpand={onToggleExpand}
							renderExpandedRow={renderExpandedRow}
							onRowClick={onRowClick}
							rowClassName={rowClassName}
							container={container}
						/>
					);
				})}
			</TableBody>
		</TooltipProvider>
	);
}
