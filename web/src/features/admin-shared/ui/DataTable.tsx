import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/button";
import Empty from "@shared/ui/empty";
import { Skeleton } from "@shared/ui/skeleton";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@shared/ui/table";
import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface DataTableColumn<T> {
	/** 列唯一标识，同时用作 React key 与排序、固定列的引用 */
	key: string;
	/** 表头内容 */
	header: React.ReactNode;
	/** 数据访问键，提供后可省略 cell，类型受 T 约束 */
	accessorKey?: keyof T;
	/** 自定义单元格渲染，不传则直接渲染 row[accessorKey] */
	cell?: (row: T) => React.ReactNode;
	/** 文本对齐，默认 left，数字列建议 right */
	align?: "left" | "center" | "right";
	/** 列宽，如 "120px" 或 "20%"，固定列建议提供以精确计算偏移 */
	width?: string;
	/** 固定列，left 固定左侧、right 固定右侧，常用于选择列与操作列 */
	sticky?: "left" | "right";
	/** 是否可排序，开启后表头可点击并回调 onSortChange */
	sortable?: boolean;
	/** 附加到 th 与 td 的类名 */
	className?: string;
}

export interface DataTableSort {
	/** 当前排序列的 key */
	key: string;
	/** 升序或降序 */
	order: "asc" | "desc";
}

export interface DataTableProps<T> {
	/** 列定义 */
	columns: DataTableColumn<T>[];
	/** 行数据，服务端已分页后的当前页数据 */
	data: T[];
	/** 行唯一键提取器 */
	keyExtractor: (row: T) => string;
	/** 加载中，渲染骨架行 */
	loading?: boolean;
	/** 错误对象，非空时渲染错误态并可重试 */
	error?: Error | null;
	/** 错误态重试回调，提供后错误态显示重试按钮 */
	onRetry?: () => void;
	/** 当前排序态，受控 */
	sort?: DataTableSort | null;
	/** 排序变更回调，服务端排序由调用方处理 */
	onSortChange?: (sort: DataTableSort) => void;
	/** 开启吸顶表头，需配合 maxHeight 形成纵向滚动容器 */
	stickyHeader?: boolean;
	/** 滚动容器最大高度，如 "60vh"，配合 stickyHeader */
	maxHeight?: string;
	/** 行密度，默认 comfortable */
	density?: "comfortable" | "compact";
	/** 行点击回调，提供后行显示 cursor-pointer 与点击态 */
	onRowClick?: (row: T) => void;
	/** 按行数据返回附加类名，用于高亮特定行 */
	rowClassName?: (row: T) => string | undefined;
	/** 表格无障碍标题，渲染为 caption 供屏幕阅读器概述 */
	caption?: string;
	/** 空状态标题 */
	emptyTitle?: string;
	/** 空状态描述 */
	emptyDescription?: string;
	/** 容器类名 */
	className?: string;
}

interface StickyOffset {
	side: "left" | "right";
	offset: string;
}

const ALIGN_CLASS: Record<"left" | "center" | "right", string> = {
	left: "text-left",
	center: "text-center",
	right: "text-right",
};

/** 骨架行用固定 id，避免数组下标作为 key */
const SKELETON_ROWS = ["sk-1", "sk-2", "sk-3", "sk-4", "sk-5"];

/** 解析 px 宽度用于固定列偏移累加，非 px 宽度回退为 0 */
function parseWidth(width?: string): number {
	if (!width) return 0;
	const matched = width.match(/^(\d+(?:\.\d+)?)px$/);
	return matched ? Number(matched[1]) : 0;
}

interface StickyBounds {
	/** 每列的偏移（key → {side, offset}） */
	offsets: Map<string, StickyOffset>;
	/** 最右的左固定列 key（左固定列组的右边缘列，在此投右阴影） */
	leftEdgeKey: string | null;
	/** 最左的右固定列 key（右固定列组的左边缘列，在此投左阴影） */
	rightEdgeKey: string | null;
}

/**
 * 预计算固定列偏移，并标记同侧的「边缘列」：
 * - leftEdgeKey：最右的左固定列（左固定列组最靠中间的一列）。
 * - rightEdgeKey：最左的右固定列。
 * 阴影画在这些边缘列的单元格上（box-shadow 朝中间内容方向），
 * 单元格本身 sticky 固定 → 阴影既贴边又不随中间列滚动，无需像素定位。
 */
function computeStickyBounds<T>(columns: DataTableColumn<T>[]): StickyBounds {
	const offsets = new Map<string, StickyOffset>();
	let left = 0;
	let leftEdgeKey: string | null = null;
	for (const col of columns) {
		if (col.sticky === "left") {
			offsets.set(col.key, { side: "left", offset: `${left}px` });
			left += parseWidth(col.width);
			leftEdgeKey = col.key; // 不断覆盖，最终拿到最右的左固定列
		}
	}
	let right = 0;
	let rightEdgeKey: string | null = null;
	for (let i = columns.length - 1; i >= 0; i -= 1) {
		const col = columns[i];
		if (col.sticky === "right") {
			offsets.set(col.key, { side: "right", offset: `${right}px` });
			right += parseWidth(col.width);
			rightEdgeKey = col.key; // 从右往左扫，最终拿到最左的右固定列
		}
	}
	return { offsets, leftEdgeKey, rightEdgeKey };
}

/** 合并固定列偏移样式与列宽 */
function mergeStyle(sticky?: React.CSSProperties, width?: string): React.CSSProperties | undefined {
	if (!sticky && !width) return undefined;
	return { ...sticky, ...(width ? { width } : {}) };
}

/**
 * 表头单元格的固定列与吸顶样式。
 * z 轴层级：普通 0 < 固定列 10 < 吸顶表头 20 < 吸顶+固定交叉 30。
 */
function headStickyClass(offset: StickyOffset | undefined, stickyHeader?: boolean): string {
	const classes: string[] = [];
	if (stickyHeader) classes.push("sticky top-0 z-20 bg-background");
	if (offset) {
		classes.push("sticky", "bg-background");
		// 固定列表头同样补内边距，与数据单元格对齐（含 checkbox 列 pr-0 覆盖）
		classes.push(offset.side === "left" ? "!pr-4" : "pl-4");
	}
	const z = stickyHeader && offset ? "z-30" : offset ? "z-10" : "";
	if (z) classes.push(z);
	return classes.join(" ");
}

/**
 * 数据单元格的固定列样式：背景不透明遮挡横向滚动内容，
 * z-10 确保浮于普通单元格之上。
 */
function cellStickyStyle(offset: StickyOffset | undefined): {
	className: string;
	style?: React.CSSProperties;
} {
	if (!offset) return { className: "" };
	// 左固定列补右内边距：shadcn Table 对含 checkbox 的单元格 pr-0，
	// 导致选择列与下一列贴在一起；用 !pr-4 覆盖，保证固定列右边距。
	const pad = offset.side === "left" ? "!pr-4" : "pl-4";
	return {
		className: cn("sticky z-10 bg-background", pad),
		style: offset.side === "left" ? { left: offset.offset } : { right: offset.offset },
	};
}

/**
 * 边缘列阴影类名（antd 风格固定列边缘 box-shadow）。
 *
 * 画在最右的左固定列（朝右投阴影）/ 最左的右固定列（朝左投阴影）。
 * 单元格本身 sticky 固定 → 阴影既贴边又不随中间列滚动，无需像素定位。
 * 仅当对应方向有可滚动内容时（visible）才显示。
 */
function edgeShadowClass(
	colKey: string,
	leftEdgeKey: string | null,
	rightEdgeKey: string | null,
	showLeft: boolean,
	showRight: boolean,
): string {
	if (colKey === leftEdgeKey && showLeft) {
		return "shadow-[8px_0_8px_-6px_rgba(0,0,0,0.16)] dark:shadow-[8px_0_8px_-6px_rgba(0,0,0,0.5)]";
	}
	if (colKey === rightEdgeKey && showRight) {
		return "shadow-[-8px_0_8px_-6px_rgba(0,0,0,0.16)] dark:shadow-[-8px_0_8px_-6px_rgba(0,0,0,0.5)]";
	}
	return "";
}

/** 渲染单元格，优先 cell，否则按 accessorKey 直读并安全转为可渲染值 */
function renderCell<T>(col: DataTableColumn<T>, row: T): React.ReactNode {
	if (col.cell) return col.cell(row);
	if (col.accessorKey != null) {
		const value = row[col.accessorKey];
		if (value == null) return null;
		if (typeof value === "string" || typeof value === "number") return value;
		return String(value);
	}
	return null;
}

function SortIcon({ active, order }: { active: boolean; order?: "asc" | "desc" }) {
	if (!active) return <ChevronsUpDown className="size-3.5 text-muted-foreground/60" />;
	if (order === "asc") return <ChevronUp className="size-3.5 text-foreground" />;
	return <ChevronDown className="size-3.5 text-foreground" />;
}

/**
 * DataTable - 通用数据表格
 *
 * 基于 shadcn Table 原语封装，支持排序、固定列（含 antd 风格边缘阴影）、
 * 吸顶表头、骨架屏、错误态与空状态。排序与分页均为服务端驱动，
 * 组件只负责 UI 与回调。
 */
export function DataTable<T>({
	columns,
	data,
	keyExtractor,
	loading,
	error,
	onRetry,
	sort,
	onSortChange,
	stickyHeader,
	maxHeight = "60vh",
	density = "comfortable",
	onRowClick,
	rowClassName,
	caption,
	emptyTitle = "NO_DATA",
	emptyDescription = "暂无数据",
	className,
}: DataTableProps<T>) {
	const { offsets, leftEdgeKey, rightEdgeKey } = useMemo(
		() => computeStickyBounds(columns),
		[columns],
	);

	const [showLeftShadow, setShowLeftShadow] = useState(false);
	const [showRightShadow, setShowRightShadow] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);

	const updateShadows = useCallback(() => {
		const el = scrollRef.current;
		if (!el) return;
		const { scrollLeft, clientWidth, scrollWidth } = el;
		// 仅当横向可滚动时启用阴影判断
		const scrollable = scrollWidth - clientWidth > 1;
		setShowLeftShadow(scrollable && scrollLeft > 1);
		setShowRightShadow(scrollable && scrollLeft + clientWidth < scrollWidth - 1);
	}, []);

	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		const handle = () => updateShadows();
		const ro = new ResizeObserver(handle);
		ro.observe(el);
		el.addEventListener("scroll", handle, { passive: true });
		requestAnimationFrame(handle);
		return () => {
			ro.disconnect();
			el.removeEventListener("scroll", handle);
		};
	}, [updateShadows]);

	const cellPad = density === "compact" ? "py-1" : "py-2.5";
	const headPad = density === "compact" ? "h-8" : "h-10";
	const colCount = columns.length;

	const emitSort = (col: DataTableColumn<T>) => {
		if (!onSortChange) return;
		const active = sort?.key === col.key;
		const order: "asc" | "desc" = active && sort?.order === "asc" ? "desc" : "asc";
		onSortChange({ key: col.key, order });
	};

	return (
		<div
			ref={scrollRef}
			role="region"
			aria-label={caption || "数据表格"}
			aria-busy={loading ? true : undefined}
			className={cn("relative overflow-auto rounded-md border border-border", className)}
			style={stickyHeader ? { maxHeight } : undefined}
			onScroll={updateShadows}
		>
			<table className="relative w-full caption-bottom text-sm">
				{caption ? <caption className="sr-only">{caption}</caption> : null}
				<TableHeader>
					<TableRow className="hover:bg-transparent">
						{columns.map((col) => {
							const offset = offsets.get(col.key);
							const stickyClass = headStickyClass(offset, stickyHeader);
							const active = sort?.key === col.key;
							let ariaSort: "none" | "ascending" | "descending" | undefined;
							if (col.sortable) {
								ariaSort = active ? (sort?.order === "asc" ? "ascending" : "descending") : "none";
							}
							return (
								<TableHead
									key={col.key}
									scope="col"
									aria-sort={ariaSort}
									className={cn(
										headPad,
										ALIGN_CLASS[col.align ?? "left"],
										stickyClass,
										edgeShadowClass(
											col.key,
											leftEdgeKey,
											rightEdgeKey,
											showLeftShadow,
											showRightShadow,
										),
										col.className,
									)}
									style={mergeStyle(offset ? cellStickyStyle(offset).style : undefined, col.width)}
								>
									{col.sortable ? (
										<button
											type="button"
											onClick={() => emitSort(col)}
											className={cn(
												"inline-flex select-none items-center gap-1 transition-colors hover:text-foreground",
												col.align === "right" && "flex-row-reverse",
												col.align === "center" && "w-full justify-center",
											)}
										>
											<span>{col.header}</span>
											<SortIcon active={active} order={active ? sort?.order : undefined} />
										</button>
									) : (
										col.header
									)}
								</TableHead>
							);
						})}
					</TableRow>
				</TableHeader>
				<TableBody>
					{error ? (
						<TableRow className="hover:bg-transparent">
							<TableCell colSpan={colCount}>
								<div className="py-12" aria-live="assertive">
									<Empty
										title="ERROR"
										description={error.message || "加载失败"}
										size="sm"
										action={
											onRetry ? (
												<Button variant="outline" size="sm" onClick={onRetry}>
													重试
												</Button>
											) : undefined
										}
									/>
								</div>
							</TableCell>
						</TableRow>
					) : loading ? (
						SKELETON_ROWS.map((sid) => (
							<TableRow key={sid} className="hover:bg-transparent">
								{columns.map((col) => (
									<TableCell
										key={col.key}
										className={cn(cellPad, ALIGN_CLASS[col.align ?? "left"])}
									>
										<Skeleton className="h-4 w-full max-w-[10rem]" />
									</TableCell>
								))}
							</TableRow>
						))
					) : data.length === 0 ? (
						<TableRow className="hover:bg-transparent">
							<TableCell colSpan={colCount}>
								<div className="py-12" aria-live="polite">
									<Empty title={emptyTitle} description={emptyDescription} size="sm" />
								</div>
							</TableCell>
						</TableRow>
					) : (
						data.map((row, index) => {
							const rowKey = keyExtractor(row);
							return (
								<TableRow
									key={rowKey}
									onClick={onRowClick ? () => onRowClick(row) : undefined}
									className={cn(
										"animate-in fade-in-0 slide-in-from-bottom-1 duration-300",
										onRowClick && "cursor-pointer",
										rowClassName?.(row),
									)}
									style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
								>
									{columns.map((col) => {
										const offset = offsets.get(col.key);
										const sp = cellStickyStyle(offset);
										return (
											<TableCell
												key={col.key}
												className={cn(
													cellPad,
													ALIGN_CLASS[col.align ?? "left"],
													sp.className,
													edgeShadowClass(
														col.key,
														leftEdgeKey,
														rightEdgeKey,
														showLeftShadow,
														showRightShadow,
													),
													col.className,
												)}
												style={mergeStyle(sp.style, col.width)}
											>
												{renderCell(col, row)}
											</TableCell>
										);
									})}
								</TableRow>
							);
						})
					)}
				</TableBody>
			</table>
		</div>
	);
}
