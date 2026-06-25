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
	/** 左侧 sticky 列总宽度（左固定列右边缘距容器左的像素值） */
	leftWidth: number;
	/** 右侧 sticky 列总宽度（右固定列左边缘距容器右的像素值） */
	rightWidth: number;
}

/**
 * 预计算固定列的左右偏移与同侧总宽度。
 * left 列偏移=其左侧所有 left 列宽度之和；right 列同理从右累加。
 * leftWidth/rightWidth 用于定位阴影条（贴在固定列的边缘）。
 */
function computeStickyBounds<T>(columns: DataTableColumn<T>[]): StickyBounds {
	const offsets = new Map<string, StickyOffset>();
	let left = 0;
	for (const col of columns) {
		if (col.sticky === "left") {
			offsets.set(col.key, { side: "left", offset: `${left}px` });
			left += parseWidth(col.width);
		}
	}
	let right = 0;
	for (let i = columns.length - 1; i >= 0; i -= 1) {
		const col = columns[i];
		if (col.sticky === "right") {
			offsets.set(col.key, { side: "right", offset: `${right}px` });
			right += parseWidth(col.width);
		}
	}
	return { offsets, leftWidth: left, rightWidth: right };
}

/** 合并固定列偏移样式与列宽 */
function mergeStyle(sticky?: React.CSSProperties, width?: string): React.CSSProperties | undefined {
	if (!sticky && !width) return undefined;
	return { ...sticky, ...(width ? { width } : {}) };
}

/** 是否存在指定侧的固定列 */
function hasStickySide<T>(columns: DataTableColumn<T>[], side: "left" | "right"): boolean {
	return columns.some((c) => c.sticky === side);
}

/**
 * 表头单元格的固定列与吸顶样式。
 * z 轴层级：普通 0 < 固定列 10 < 吸顶表头 20 < 吸顶+固定交叉 30。
 */
function headStickyClass(offset: StickyOffset | undefined, stickyHeader?: boolean): string {
	const classes: string[] = [];
	if (stickyHeader) classes.push("sticky top-0 z-20 bg-background");
	if (offset) classes.push("sticky", "bg-background");
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
	return {
		className: "sticky z-10 bg-background",
		style: offset.side === "left" ? { left: offset.offset } : { right: offset.offset },
	};
}

interface StickyShadowProps {
	side: "left" | "right";
	visible: boolean;
	/** 阴影条距固定列边缘的偏移（px）：left 用 leftWidth（左固定列总宽），right 用 rightWidth */
	offset: number;
}

/** 阴影宽度（px） */
const SHADOW_W = 20;

/**
 * 固定列边缘阴影条（antd 风格）。
 *
 * 用线性渐变模拟阴影（非 box-shadow，避免被 overflow 裁切），
 * 贴在固定列的边缘、贯穿全表行高，z-30 浮于所有单元格之上。
 * - left 阴影：贴在左固定列右边缘（left: leftWidth），向右淡出。
 * - right 阴影：贴在右固定列左边缘（right: rightWidth），向左淡出。
 * 仅当对应方向还有可滚动内容时显示。
 */
function StickyShadow({ side, visible, offset }: StickyShadowProps) {
	const isLeft = side === "left";
	// left 阴影：左端浓、右端淡（从固定列向内容方向淡出）
	// right 阴影：右端浓、左端淡
	const gradient = isLeft
		? "linear-gradient(to right, hsl(var(--foreground)/0.18), transparent)"
		: "linear-gradient(to left, hsl(var(--foreground)/0.18), transparent)";
	return (
		<div
			aria-hidden
			className={cn(
				"pointer-events-none absolute inset-y-0 z-30 transition-opacity duration-200",
				visible ? "opacity-100" : "opacity-0",
			)}
			style={{
				width: SHADOW_W,
				...(isLeft ? { left: `${offset}px` } : { right: `${offset}px` }),
				backgroundImage: gradient,
			}}
		/>
	);
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
	const { offsets, leftWidth, rightWidth } = useMemo(() => computeStickyBounds(columns), [columns]);
	const hasLeftSticky = useMemo(() => hasStickySide(columns, "left"), [columns]);
	const hasRightSticky = useMemo(() => hasStickySide(columns, "right"), [columns]);

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
			role="region"
			aria-label={caption || "数据表格"}
			aria-busy={loading ? true : undefined}
			className={cn("relative rounded-md border border-border", className)}
		>
			{/* antd 风格固定列边缘阴影：放在外层（非滚动流），不跟随横向滚动 */}
			{hasLeftSticky ? (
				<StickyShadow side="left" visible={showLeftShadow} offset={leftWidth} />
			) : null}
			{hasRightSticky ? (
				<StickyShadow side="right" visible={showRightShadow} offset={rightWidth} />
			) : null}

			{/* 滚动容器：scrollRef 挂这里，监听 scrollLeft 触发阴影显隐 */}
			<div
				ref={scrollRef}
				className="overflow-auto"
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
											col.className,
										)}
										style={mergeStyle(
											offset ? cellStickyStyle(offset).style : undefined,
											col.width,
										)}
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
		</div>
	);
}
