"use client";

import { cn } from "cn";
import {
	type CSSProperties,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { Button } from "../button";
import { ScrollArea } from "../scroll-area";
import { DataTableBody } from "./data-table-body";
import { DataTableFooter } from "./data-table-footer";
import { DataTableHeader } from "./data-table-header";
import type { DataTableColumn, DataTableProps } from "./data-table-types";
import {
	COLUMNS_CONTROL_KEY,
	EXPAND_COLUMN_KEY,
	isFitContent,
	isGutterKey,
	SELECT_COLUMN_KEY,
} from "./data-table-types";
import { computeStickyOffsets } from "./sticky-utils";

const DEFAULT_COLUMN_MIN_WIDTH = 80;
/** 未声明宽度的列在累加最小总宽时的基准 */
const FALLBACK_COLUMN_WIDTH = 120;
const EXPAND_COLUMN_WIDTH = 32;
const CONTROL_COLUMN_WIDTH = 32;
const SELECT_COLUMN_WIDTH = 36;

function readJson<V>(key: string | undefined, fallback: V): V {
	if (!key) return fallback;
	try {
		const raw = localStorage.getItem(key);
		return raw ? (JSON.parse(raw) as V) : fallback;
	} catch {
		return fallback;
	}
}

function writeJson(key: string | undefined, value: unknown) {
	if (!key) return;
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// 写入失败（隐私模式、配额）不影响表格功能
	}
}

const injectedColumn = <T,>(key: string, width: number): DataTableColumn<T> => ({
	key,
	header: null,
	sticky: "left",
	width: `${width}px`,
	hideable: false,
	sortable: false,
	align: "center",
});

/**
 * 后台所有列表共用的数据表格：不套卡片，排序、跨页勾选、展开、列显隐与列宽、固定列、分页、
 * 加载 / 出错 / 空 / 筛选后为空四种状态都在内。
 *
 * @typeParam T - 行数据类型
 * @example
 * ```tsx
 * <DataTable
 *   caption="文章"
 *   columns={[{ key: "title", header: "标题", accessorKey: "title", ellipsis: true }]}
 *   data={posts}
 *   keyExtractor={(post) => post.id}
 * />
 * ```
 */
export function DataTable<T>({
	columns,
	data,
	keyExtractor,
	pagination,
	sort,
	onSortChange,
	loading,
	error,
	onRetry,
	selectable = false,
	selectedIds,
	onSelectionChange,
	bulkActions,
	onSelectAll,
	totalSelectable,
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
	caption,
	emptyTitle,
	emptyDescription,
	emptyAction,
	filteredTitle,
	filteredDescription,
	filteredAction,
	errorTitle,
	container,
	className,
}: DataTableProps<T>) {
	const rootRef = useRef<HTMLDivElement>(null);
	const scrollRef = useRef<HTMLDivElement>(null);
	const tableRef = useRef<HTMLTableElement>(null);

	const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(
		() => new Set(readJson<string[]>(storageKey, [])),
	);
	useEffect(() => writeJson(storageKey, [...hiddenKeys]), [hiddenKeys, storageKey]);

	const toggleColumn = (key: string) => {
		setHiddenKeys((prev) => {
			const next = new Set(prev);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	};

	// 只存用户手动调整的列宽；键名带 v2 是为了不读取早期记下的自适应宽度
	const widthStorageKey = storageKey ? `${storageKey}-widths-v2` : undefined;
	const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() =>
		readJson<Record<string, number>>(widthStorageKey, {}),
	);
	useEffect(() => writeJson(widthStorageKey, columnWidths), [columnWidths, widthStorageKey]);

	const resetColumns = () => {
		setHiddenKeys(new Set());
		setColumnWidths({});
		if (widthStorageKey) {
			try {
				localStorage.removeItem(widthStorageKey);
			} catch {
				// 同 writeJson
			}
		}
	};

	// 选中态受控优先，否则内部自管；均跨页保持
	const [internalSelected, setInternalSelected] = useState<Set<string>>(() => new Set());
	const selected = selectedIds ?? internalSelected;
	const setSelected = (next: Set<string>) => {
		setInternalSelected(next);
		onSelectionChange?.(next);
	};

	const pageIds = useMemo(() => data.map(keyExtractor), [data, keyExtractor]);
	const selectedOnPage = pageIds.filter((id) => selected.has(id)).length;
	const allSelected = pageIds.length > 0 && selectedOnPage === pageIds.length;
	const someSelected = selectedOnPage > 0 && !allSelected;

	const toggleSelectAll = () => {
		const next = new Set(selected);
		for (const id of pageIds) {
			if (allSelected || someSelected) next.delete(id);
			else next.add(id);
		}
		setSelected(next);
	};

	const toggleRow = (id: string) => {
		const next = new Set(selected);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		setSelected(next);
	};

	const clearSelection = () => {
		setSelected(new Set());
		// 批量栏随即不可交互，焦点交还给全选框
		rootRef.current?.querySelector<HTMLElement>("[data-select-all]")?.focus();
	};

	const [internalExpanded, setInternalExpanded] = useState<Set<string>>(() => new Set());
	const expanded = expandedRowKeys ?? internalExpanded;
	const toggleExpand = (id: string) => {
		const next = new Set(expanded);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		setInternalExpanded(next);
		onExpandedChange?.(next);
	};

	const hideableColumns = useMemo(() => columns.filter((c) => c.hideable !== false), [columns]);
	const showColumnControl = !!storageKey && hideableColumns.length > 0;

	// 左侧依次是：展开列（没有则单独的「显示列」列）、勾选列
	const visibleColumns = useMemo<DataTableColumn<T>[]>(() => {
		const injected: DataTableColumn<T>[] = [];
		if (expandable) injected.push(injectedColumn(EXPAND_COLUMN_KEY, EXPAND_COLUMN_WIDTH));
		else if (showColumnControl)
			injected.push(injectedColumn(COLUMNS_CONTROL_KEY, CONTROL_COLUMN_WIDTH));
		if (selectable) injected.push(injectedColumn(SELECT_COLUMN_KEY, SELECT_COLUMN_WIDTH));
		return [...injected, ...columns.filter((c) => !hiddenKeys.has(c.key))];
	}, [columns, hiddenKeys, expandable, selectable, showColumnControl]);

	// fitContent 列只测量不可截断的单元格；其余未显式调整的列保持自适应
	const [fitContentWidths, setFitContentWidths] = useState<Record<string, number>>({});
	useLayoutEffect(() => {
		if (loading || error || data.length === 0 || !visibleColumns.some(isFitContent)) {
			setFitContentWidths((prev) => (Object.keys(prev).length === 0 ? prev : {}));
			return;
		}
		const widths: Record<string, number> = {};
		for (const element of tableRef.current?.querySelectorAll<HTMLElement>(
			"[data-fit-content]",
		) ?? []) {
			const key = element.dataset.fitContent;
			const cell = element.closest("td");
			if (!key || !cell) continue;
			const style = getComputedStyle(cell);
			const width =
				Math.ceil(element.getBoundingClientRect().width) +
				parseFloat(style.paddingLeft) +
				parseFloat(style.paddingRight);
			widths[key] = Math.max(widths[key] ?? 0, width);
		}
		setFitContentWidths((prev) =>
			Object.keys(prev).length === Object.keys(widths).length &&
			Object.entries(widths).every(([key, width]) => prev[key] === width)
				? prev
				: widths,
		);
	}, [data, visibleColumns, loading, error]);

	// 勾选、展开、显示列与右固定列的宽度永远精确，设备上记下的这些列的宽度不采信
	const userWidths = useMemo(() => {
		const result: Record<string, number> = {};
		for (const col of visibleColumns) {
			const width = columnWidths[col.key];
			if (width != null && !isGutterKey(col.key) && col.sticky !== "right") {
				result[col.key] = width;
			}
		}
		return result;
	}, [visibleColumns, columnWidths]);

	// 伸缩列：第一个没被用户拖过宽度的非固定数据列，colgroup 不给宽度，多余的宽度只归它；
	// 都被拖过时退到最后一个非固定数据列，其宽度仍计入表格最小宽度
	const flexKey = useMemo(() => {
		const candidates = visibleColumns.filter(
			(col) => !isGutterKey(col.key) && !col.sticky && !isFitContent(col),
		);
		return (candidates.find((col) => userWidths[col.key] == null) ?? candidates.at(-1))?.key;
	}, [visibleColumns, userWidths]);

	const columnWidthMap = useMemo(() => {
		const map = new Map<string, number>();
		for (const col of visibleColumns) {
			const matched = col.width?.match(/^(\d+(?:\.\d+)?)px$/);
			map.set(
				col.key,
				Math.max(
					userWidths[col.key] ?? (matched ? Number(matched[1]) : 0),
					isFitContent(col) ? (fitContentWidths[col.key] ?? 0) : 0,
				),
			);
		}
		return map;
	}, [visibleColumns, userWidths, fitContentWidths]);

	const colgroupWidths = useMemo(() => {
		const map = new Map<string, string>();
		for (const col of visibleColumns) {
			if (col.key === flexKey) continue;
			if (
				userWidths[col.key] != null ||
				(isFitContent(col) && fitContentWidths[col.key] != null)
			) {
				map.set(col.key, `${columnWidthMap.get(col.key)}px`);
			} else if (col.width) {
				map.set(col.key, col.width);
			}
		}
		return map;
	}, [visibleColumns, userWidths, fitContentWidths, columnWidthMap, flexKey]);

	const offsets = useMemo(
		() => computeStickyOffsets(visibleColumns, columnWidthMap),
		[visibleColumns, columnWidthMap],
	);

	// 表格最小宽度 = 各列宽度之和：容器放不下时横向滚动，不把列挤成一线
	const minTableWidth = useMemo(
		() =>
			visibleColumns.reduce(
				(sum, col) => sum + (columnWidthMap.get(col.key) || FALLBACK_COLUMN_WIDTH),
				0,
			),
		[visibleColumns, columnWidthMap],
	);

	// 状态与展开面板从标题列起对齐，批量栏从勾选列之后盖住表头
	const leadWidth = visibleColumns
		.filter((col) => isGutterKey(col.key))
		.reduce((sum, col) => sum + (columnWidthMap.get(col.key) ?? 0), 0);

	// 滚动状态直接写 DOM 属性，滚动与缩放不触发表格重渲染
	const syncScrollState = useCallback(() => {
		const root = rootRef.current;
		const scroller = scrollRef.current;
		if (!root || !scroller) return;
		const { scrollLeft, scrollWidth, clientWidth } = scroller;
		root.toggleAttribute("data-scrolled-start", scrollLeft > 0);
		root.toggleAttribute("data-scrolled-end", scrollLeft < scrollWidth - clientWidth - 1);
		root.style.setProperty("--v-table-viewport", `${clientWidth}px`);
	}, []);

	useEffect(() => {
		const scroller = scrollRef.current;
		if (!scroller) return;
		syncScrollState();
		scroller.addEventListener("scroll", syncScrollState, { passive: true });
		window.addEventListener("resize", syncScrollState);
		// 容器变化（侧边栏折叠）与表格自身变化（列显隐、列宽）都可能改变是否有横向滚动
		const observer = new ResizeObserver(syncScrollState);
		observer.observe(scroller);
		if (tableRef.current) observer.observe(tableRef.current);
		return () => {
			scroller.removeEventListener("scroll", syncScrollState);
			window.removeEventListener("resize", syncScrollState);
			observer.disconnect();
		};
	}, [syncScrollState]);

	const resizeColumn = (key: string, width: number) => {
		setColumnWidths((prev) => ({ ...prev, [key]: width }));
	};

	const selectableTotal = totalSelectable ?? pagination?.total;
	const canSelectAll =
		onSelectAll != null &&
		allSelected &&
		selectableTotal != null &&
		selected.size < selectableTotal;
	const bulkOpen = selected.size > 0;
	const showBulkBar = selectable && bulkActions != null;
	const offPage = selected.size - selectedOnPage;

	return (
		<div
			ref={rootRef}
			data-slot="data-table"
			data-density={density}
			className={cn("v-data-table", className)}
			style={{ "--v-table-lead": `${leadWidth}px` } as CSSProperties}
		>
			{toolbar ? <div className="v-data-table__toolbar">{toolbar}</div> : null}

			<div className="v-data-table__frame">
				<ScrollArea
					ref={scrollRef}
					className="v-data-table__scroller"
					orientation="both"
					role="region"
					tabIndex={0}
					aria-label={caption ?? "数据表格"}
					// 视口自己占据弹性剩余高度而不是写 100% 高度：根容器高度 auto、只靠 max-block-size 限高时，百分比高度没有确定值
					style={
						{
							height: "auto",
							flex: "1 1 0%",
							minHeight: 0,
							"--v-scroll-area-padding": "0px",
						} as CSSProperties
					}
				>
					<table
						ref={tableRef}
						data-slot="table"
						className="v-table"
						aria-busy={loading ? true : undefined}
						style={{ minWidth: `${minTableWidth}px` }}
					>
						{caption ? <caption className="v-table__sr">{caption}</caption> : null}
						<colgroup>
							{visibleColumns.map((col) => {
								const width = colgroupWidths.get(col.key);
								return <col key={col.key} style={width ? { width } : undefined} />;
							})}
						</colgroup>
						<DataTableHeader
							columns={visibleColumns}
							offsets={offsets}
							sort={sort}
							onSortChange={onSortChange}
							allSelected={allSelected}
							someSelected={someSelected}
							onToggleSelectAll={toggleSelectAll}
							resizable={resizable}
							columnMinWidth={columnMinWidth}
							onResizeColumn={resizeColumn}
							container={container}
							columnControl={
								showColumnControl
									? {
											columns: hideableColumns,
											hiddenKeys,
											onToggle: toggleColumn,
											canReset:
												hiddenKeys.size > 0 ||
												Object.keys(userWidths).length > 0,
											onReset: resetColumns,
										}
									: undefined
							}
						/>
						<DataTableBody
							columns={visibleColumns}
							data={data}
							keyExtractor={keyExtractor}
							offsets={offsets}
							loading={loading}
							error={error}
							onRetry={onRetry}
							filtered={filtered}
							errorTitle={errorTitle}
							emptyTitle={emptyTitle}
							emptyDescription={emptyDescription}
							emptyAction={emptyAction}
							filteredTitle={filteredTitle}
							filteredDescription={filteredDescription}
							filteredAction={filteredAction}
							container={container}
							selectable={selectable}
							selectedIds={selected}
							onToggleRow={toggleRow}
							expandable={expandable}
							expandedRowFixed={expandedRowFixed}
							expandedRowKeys={expanded}
							onToggleExpand={toggleExpand}
							renderExpandedRow={renderExpandedRow}
							onRowClick={onRowClick}
							rowClassName={rowClassName}
							pageBaseIndex={
								pagination ? (pagination.page - 1) * pagination.pageSize : 0
							}
						/>
					</table>
				</ScrollArea>

				{showBulkBar ? (
					<div
						className="v-data-table__bulk"
						role="toolbar"
						aria-label="批量操作"
						data-open={bulkOpen ? "" : undefined}
						aria-hidden={bulkOpen ? undefined : true}
						inert={!bulkOpen}
					>
						<span className="v-data-table__bulk-count" aria-live="polite">
							已选 <b className="v-table__num">{selected.size}</b> 项
							{offPage > 0 ? (
								<>
									，其中 <span className="v-table__num">{offPage}</span>{" "}
									项不在本页
								</>
							) : null}
						</span>
						{canSelectAll ? (
							<Button
								variant="ghost"
								size="sm"
								className="v-data-table__bulk-all"
								onClick={onSelectAll}
							>
								选中全部 <span className="v-table__num">{selectableTotal}</span> 项
							</Button>
						) : null}
						<i className="v-data-table__bulk-divider" aria-hidden="true" />
						{bulkActions}
						<span className="v-data-table__bulk-spacer" />
						<Button variant="ghost" size="sm" onClick={clearSelection}>
							取消选择
						</Button>
					</div>
				) : null}
			</div>

			{pagination && pagination.total > 0 ? (
				<DataTableFooter
					page={pagination.page}
					pageSize={pagination.pageSize}
					total={pagination.total}
					onChange={pagination.onChange}
					pageSizeOptions={pagination.pageSizeOptions}
					hidePageSizeSelect={pagination.hidePageSizeSelect}
					container={container}
				/>
			) : null}
		</div>
	);
}
