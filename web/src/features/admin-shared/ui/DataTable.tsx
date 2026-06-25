import { useSpotlight } from "@shared/lib/hooks/use-spotlight";
import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/button";
import Empty from "@shared/ui/empty";
import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@shared/ui/table";
import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react";
import { useMemo } from "react";

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
	/** 加载中，渲染 shimmer 骨架行 */
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
	/** 开启行 hover 聚光灯，默认 true */
	spotlight?: boolean;
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

interface StickyStyle {
	className: string;
	style?: React.CSSProperties;
}

const ALIGN_CLASS: Record<"left" | "center" | "right", string> = {
	left: "text-left",
	center: "text-center",
	right: "text-right",
};

const LEFT_SHADOW = "shadow-[inset_-8px_0_8px_-8px_rgba(0,0,0,0.12)]";
const RIGHT_SHADOW = "shadow-[inset_8px_0_8px_-8px_rgba(0,0,0,0.12)]";

/** 骨架行用固定 id，避免数组下标作为 key */
const SKELETON_ROWS = ["sk-1", "sk-2", "sk-3", "sk-4", "sk-5"];

/** 解析 px 宽度用于固定列偏移累加，非 px 宽度回退为 0 */
function parseWidth(width?: string): number {
	if (!width) return 0;
	const matched = width.match(/^(\d+(?:\.\d+)?)px$/);
	return matched ? Number(matched[1]) : 0;
}

/** 预计算固定列的左右偏移，同侧多列按宽度累加 */
function computeStickyOffsets<T>(columns: DataTableColumn<T>[]): Map<string, StickyOffset> {
	const map = new Map<string, StickyOffset>();
	let left = 0;
	for (const col of columns) {
		if (col.sticky === "left") {
			map.set(col.key, { side: "left", offset: `${left}px` });
			left += parseWidth(col.width);
		}
	}
	let right = 0;
	for (let i = columns.length - 1; i >= 0; i -= 1) {
		const col = columns[i];
		if (col.sticky === "right") {
			map.set(col.key, { side: "right", offset: `${right}px` });
			right += parseWidth(col.width);
		}
	}
	return map;
}

/** 合并固定列偏移样式与列宽 */
function mergeStyle(sticky?: React.CSSProperties, width?: string): React.CSSProperties | undefined {
	if (!sticky && !width) return undefined;
	return { ...sticky, ...(width ? { width } : {}) };
}

/** 表头单元格的固定列与吸顶相关类名，z 轴在交叉处取高层级 */
function headSticky(offset: StickyOffset | undefined, stickyHeader?: boolean): StickyStyle {
	const classes: string[] = [];
	let style: React.CSSProperties | undefined;
	if (stickyHeader) classes.push("sticky top-0 bg-background/80 backdrop-blur-xl");
	if (offset) {
		classes.push(
			"sticky bg-background/80 backdrop-blur-xl",
			offset.side === "left" ? LEFT_SHADOW : RIGHT_SHADOW,
		);
		style = offset.side === "left" ? { left: offset.offset } : { right: offset.offset };
	}
	const z = stickyHeader && offset ? "z-30" : stickyHeader ? "z-20" : offset ? "z-10" : "";
	if (z) classes.push(z);
	return { className: cn(classes), style };
}

/** 数据单元格的固定列类名，背景不透明以遮挡横向滚动内容 */
function cellSticky(offset: StickyOffset | undefined): StickyStyle {
	if (!offset) return { className: "" };
	return {
		className: cn("sticky z-10 bg-background", offset.side === "left" ? LEFT_SHADOW : RIGHT_SHADOW),
		style: offset.side === "left" ? { left: offset.offset } : { right: offset.offset },
	};
}

/** 行样式，逐行淡入的延迟与可选的聚光跟随背景 */
function rowStyle(index: number, spotlight: boolean): React.CSSProperties {
	const style: React.CSSProperties = { animationDelay: `${Math.min(index, 12) * 30}ms` };
	if (spotlight) {
		style.backgroundImage =
			"radial-gradient(160px circle at var(--spot-x, 50%) var(--spot-y, 50%), hsl(var(--glow-soft) / calc(0.14 * var(--row-glow, 0))), transparent 65%)";
	}
	return style;
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
 * 基于 shadcn Table 原语封装，支持排序、固定列、吸顶表头、骨架屏、
 * 错误态与行 hover 聚光灯。排序与分页均为服务端驱动，组件只负责 UI 与回调。
 * 新增能力全部可选，旧用法 columns + data + keyExtractor 完全兼容。
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
	spotlight = true,
	caption,
	emptyTitle = "NO_DATA",
	emptyDescription = "暂无数据",
	className,
}: DataTableProps<T>) {
	const onRowMove = useSpotlight();
	const offsets = useMemo(() => computeStickyOffsets(columns), [columns]);

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
			className={cn("overflow-auto rounded-md border border-edge-hairline", className)}
			style={stickyHeader ? { maxHeight } : undefined}
			aria-busy={loading ? true : undefined}
		>
			<table className="w-full caption-bottom text-sm">
				{caption ? <caption className="sr-only">{caption}</caption> : null}
				<TableHeader>
					<TableRow className="hover:bg-transparent">
						{columns.map((col) => {
							const sp = headSticky(offsets.get(col.key), stickyHeader);
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
										sp.className,
										col.className,
									)}
									style={mergeStyle(sp.style, col.width)}
								>
									{col.sortable ? (
										<button
											type="button"
											onClick={() => emitSort(col)}
											className={cn(
												"inline-flex items-center gap-1 select-none transition-colors hover:text-foreground",
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
										<ShimmerSkeleton className="h-4 w-full max-w-[10rem]" />
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
									onMouseMove={spotlight ? onRowMove : undefined}
									onClick={onRowClick ? () => onRowClick(row) : undefined}
									className={cn(
										"animate-in fade-in-0 slide-in-from-bottom-1 duration-300",
										onRowClick && "cursor-pointer",
										spotlight && "[--row-glow:0] hover:[--row-glow:1]",
										rowClassName?.(row),
									)}
									style={rowStyle(index, spotlight ?? false)}
								>
									{columns.map((col) => {
										const sp = cellSticky(offsets.get(col.key));
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
	);
}
