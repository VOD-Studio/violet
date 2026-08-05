import type { ReactNode } from "react";

/** 列定义 */
export interface DataTableColumn<T> {
	/** 列唯一标识，同时用作 React key、排序引用与固定列偏移引用 */
	key: string;
	/** 表头内容 */
	header: ReactNode;
	/** 提供后可省略 cell，直接渲染 row[accessorKey] */
	accessorKey?: keyof T;
	/** 自定义单元格渲染，优先级高于 accessorKey */
	cell?: (row: T) => ReactNode;
	/** 文本对齐，默认 left */
	align?: "left" | "center" | "right";
	/** 列宽，如 "120px" 或 "20%"；固定列建议 px 以精确累加偏移 */
	width?: string;
	/** 固定列，left/right 分别贴边，同侧多列按宽度累加 */
	sticky?: "left" | "right";
	/** 开启后表头可点击触发 onSortChange */
	sortable?: boolean;
	/** 是否允许在列可见性菜单隐藏，默认 true */
	hideable?: boolean;
	/** 是否允许拖拽调整列宽，默认跟随组件 resizable */
	resizable?: boolean;
	/** 单元格内容超长时省略号截断，鼠标悬停 tooltip 显示全文，默认 false */
	ellipsis?: boolean;
	/** 鼠标悬停单元格时显示的 tooltip，提供即开启 tooltip */
	tooltip?: (row: T) => string;
	/** CSV 导出时取值，默认按 accessorKey 取原始值 */
	exportValue?: (row: T) => string | number | null;
	/** 附加到 th 与 td 的类名 */
	className?: string;
}

/** 排序态，由调用方受控 */
export interface DataTableSort {
	/** 排序列的 key */
	key: string;
	/** 升序或降序 */
	order: "asc" | "desc";
}

export interface DataTableProps<T> {
	columns: DataTableColumn<T>[];
	/** 当前页数据，由调用方按分页参数从服务端取回 */
	data: T[];
	/** 行唯一键提取器，生成的 id 同时用于行选择与展开状态 */
	keyExtractor: (row: T) => string;

	/** 当前页码（从 1 开始） */
	page: number;
	/** 每页条数 */
	pageSize: number;
	/** 总条数，组件据此计算 totalPages */
	total: number;
	/** 翻页回调 */
	onPageChange: (page: number) => void;
	/** 可选每页条数，默认 [10, 20, 50]；提供 onPageSizeChange 时才显示切换器 */
	pageSizeOptions?: number[];
	/** 每页条数变更回调 */
	onPageSizeChange?: (size: number) => void;

	/** 排序态（受控，可选） */
	sort?: DataTableSort | null;
	/** 排序变更回调 */
	onSortChange?: (sort: DataTableSort) => void;

	/** 加载中，渲染骨架行 */
	loading?: boolean;
	/** 错误对象，非空时渲染错误态 */
	error?: Error | null;
	/** 错误态重试回调，提供后显示重试按钮 */
	onRetry?: () => void;

	/** 开启行多选，注入左侧固定 checkbox 列 */
	selectable?: boolean;
	/** 已选中行 id 集合（受控）；不传则组件内部自管，均跨页保持 */
	selectedIds?: Set<string>;
	/** 选中态变更回调 */
	onSelectionChange?: (ids: Set<string>) => void;
	/** 批量操作区，渲染在工具栏内联提示与底部浮动操作条 */
	bulkActions?: ReactNode;

	/** 开启行展开，注入展开切换列 */
	expandable?: boolean;
	/** 展开行固定不随横向滚动（单 cell sticky），忽略固定列；默认 false */
	expandedRowFixed?: boolean;
	/** 已展开行 id 集合（受控） */
	expandedRowKeys?: Set<string>;
	/** 展开态变更回调 */
	onExpandedChange?: (keys: Set<string>) => void;
	/** 展开行渲染的内容 */
	renderExpandedRow?: (row: T) => ReactNode;

	/** 整行点击回调，提供后行显示 cursor-pointer */
	onRowClick?: (row: T) => void;
	/** 根据行数据返回行类名，用于高亮特定状态 */
	rowClassName?: (row: T) => string;

	/** 开启列宽拖拽调整，宽度持久化到 localStorage */
	resizable?: boolean;
	/** 列最小宽度，默认 80 */
	columnMinWidth?: number;

	/** 顶部工具栏左侧筛选槽位，由调用方自定义内容 */
	toolbar?: ReactNode;
	/** 列可见性与列宽持久化到 localStorage 的前缀 key */
	storageKey?: string;

	/** 当前是否处于筛选态；为 true 且无数据时空态文案改为"未找到匹配结果" */
	filtered?: boolean;

	/** 行密度，默认 comfortable */
	density?: "comfortable" | "compact";
	/** 开启吸顶表头，配合 maxHeight 形成纵向滚动 */
	stickyHeader?: boolean;
	/** 滚动容器最大高度，配合 stickyHeader */
	maxHeight?: string;
	/** 无障碍标题，渲染为 sr-only caption */
	caption?: string;
	/** 空状态标题（filtered=false 时） */
	emptyTitle?: string;
	/** 空状态描述（filtered=false 时） */
	emptyDescription?: string;
	/** 容器类名 */
	className?: string;
}

/** 选择列保留 key */
export const SELECT_COLUMN_KEY = "__select";
/** 展开列保留 key */
export const EXPAND_COLUMN_KEY = "__expand";
/** 列控制按钮列保留 key（表头末尾，sticky right） */
export const COLUMNS_CONTROL_KEY = "__columns_control";
