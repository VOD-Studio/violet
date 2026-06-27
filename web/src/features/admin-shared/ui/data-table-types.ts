import type { ReactNode } from "react";

/**
 * DataTableColumn - 列定义
 *
 * key 同时用作 React key、排序引用与固定列偏移引用，必须全表唯一。
 */
export interface DataTableColumn<T> {
	/** 列唯一标识 */
	key: string;
	/** 表头内容 */
	header: ReactNode;
	/** 数据访问键，提供后可省略 cell 直接渲染 row[accessorKey] */
	accessorKey?: keyof T;
	/** 自定义单元格渲染，优先级高于 accessorKey */
	cell?: (row: T) => ReactNode;
	/** 文本对齐，默认 left，数字列建议 right */
	align?: "left" | "center" | "right";
	/** 列宽，如 "120px" 或 "20%"；固定列建议 px 以精确算偏移 */
	width?: string;
	/** 固定列，left/right 分别贴左右边；同侧多列按宽度累加偏移 */
	sticky?: "left" | "right";
	/** 可排序，开启后表头可点击并回调 onSortChange */
	sortable?: boolean;
	/** 是否允许在列可见性菜单隐藏，默认 true */
	hideable?: boolean;
	/** 附加到 th 与 td 的类名 */
	className?: string;
}

/**
 * DataTableSort - 排序态（服务端受控）
 */
export interface DataTableSort {
	/** 当前排序列的 key */
	key: string;
	/** 升序或降序 */
	order: "asc" | "desc";
}

/**
 * DataTableProps - 主组件 props
 *
 * 分页与排序均为服务端受控，组件只负责 UI 与回调。
 */
export interface DataTableProps<T> {
	/** 列定义 */
	columns: DataTableColumn<T>[];
	/** 当前页数据（服务端已分页） */
	data: T[];
	/** 行唯一键提取器 */
	keyExtractor: (row: T) => string;

	/** 当前页码（从 1 开始） */
	page: number;
	/** 每页条数 */
	pageSize: number;
	/** 总条数，内部据此算 totalPages */
	total: number;
	/** 翻页回调 */
	onPageChange: (page: number) => void;

	/** 当前排序态（服务端受控，可选） */
	sort?: DataTableSort | null;
	/** 排序变更回调 */
	onSortChange?: (sort: DataTableSort) => void;

	/** 加载中，渲染骨架行 */
	loading?: boolean;
	/** 错误对象，非空时渲染错误态 */
	error?: Error | null;
	/** 错误态重试回调，提供后显示重试按钮 */
	onRetry?: () => void;

	/** 顶部工具栏左侧筛选槽位（搜索框/下拉等，调用方自定义） */
	toolbar?: ReactNode;
	/** 列可见性持久化到 localStorage 的 key */
	storageKey?: string;

	/** 行密度，默认 comfortable */
	density?: "comfortable" | "compact";
	/** 开启吸顶表头，配合 maxHeight 形成纵向滚动容器 */
	stickyHeader?: boolean;
	/** 滚动容器最大高度，如 "60vh"，配合 stickyHeader */
	maxHeight?: string;
	/** 表格无障碍标题，渲染为 sr-only caption */
	caption?: string;
	/** 空状态标题 */
	emptyTitle?: string;
	/** 空状态描述 */
	emptyDescription?: string;
	/** 容器类名 */
	className?: string;
}
