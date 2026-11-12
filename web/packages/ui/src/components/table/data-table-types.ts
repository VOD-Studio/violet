import type { ReactNode } from "react";

/** 列定义。 */
export interface DataTableColumn<T> {
	/** 列唯一标识，同时用作 React key、排序引用与固定列偏移引用 */
	key: string;
	/** 表头内容；列显隐菜单与 CSV 表头只认字符串或数字 */
	header: ReactNode;
	/** 提供后可省略 cell，直接渲染 row[accessorKey] */
	accessorKey?: keyof T;
	/** 自定义单元格渲染，优先级高于 accessorKey */
	cell?: (row: T) => ReactNode;
	/** 文本对齐，默认 left；right 的列数字等宽（tabular-nums） */
	align?: "left" | "center" | "right";
	/** 列宽，如 "120px" 或 "20%"；固定列建议 px 以精确累加偏移 */
	width?: string;
	/** 按行内容最大宽度撑开列（width 作最小宽度）；右固定列默认开启，可显式关闭 */
	fitContent?: boolean;
	/** 固定列，left/right 分别贴边，同侧多列按宽度累加 */
	sticky?: "left" | "right";
	/** 开启后表头可点击触发 onSortChange */
	sortable?: boolean;
	/** 是否允许在「显示列」菜单隐藏，默认 true */
	hideable?: boolean;
	/** 是否允许拖拽调整列宽，默认跟随组件 resizable */
	resizable?: boolean;
	/** 单元格内容超长时省略号截断，悬停且确实被截断时 tooltip 显示全文，默认 false */
	ellipsis?: boolean;
	/** 悬停单元格时显示的 tooltip，提供即开启 tooltip（不论是否被截断） */
	tooltip?: (row: T) => string;
	/** CSV 导出时取值，默认按 accessorKey 取原始值 */
	exportValue?: (row: T) => string | number | null;
	/** 附加到 th 与 td 的类名 */
	className?: string;
	/** 该列单元格点击不触发行点击回调（操作列等纯按钮区）：td 层拦截冒泡，兼容禁用按钮不派发 click 落到单元格的场景 */
	stopClickPropagation?: boolean;
}

/** 排序态，由调用方受控。 */
export interface DataTableSort {
	/** 排序列的 key */
	key: string;
	/** 升序或降序 */
	order: "asc" | "desc";
}

/** 分页配置（服务端与客户端分页共用）。 */
export interface DataTablePagination {
	/** 当前页码（从 1 开始） */
	page: number;
	/** 每页条数 */
	pageSize: number;
	/** 总条数，组件据此计算总页数 */
	total: number;
	/**
	 * 分页变更回调
	 *
	 * @param page 新页码
	 * @param pageSize 新每页条数（翻页时不变，切换条数时为新值且 page 重置为 1）
	 */
	onChange: (page: number, pageSize: number) => void;
	/** 可选每页条数，默认 `[10, 20, 50]` */
	pageSizeOptions?: number[];
	/** 隐藏每页条数选择器；固定 pageSize 的页面传 true */
	hidePageSizeSelect?: boolean;
}

export interface DataTableProps<T> {
	columns: DataTableColumn<T>[];
	/** 当前页数据，由调用方按分页参数取回 */
	data: T[];
	/** 行唯一键提取器，生成的 id 同时用于行选择与展开状态 */
	keyExtractor: (row: T) => string;

	/** 分页配置；不传则没有分页栏，适合前端全量列表 */
	pagination?: DataTablePagination;

	/** 排序态（受控） */
	sort?: DataTableSort | null;
	/** 排序变更回调；点一下升序，再点降序 */
	onSortChange?: (sort: DataTableSort) => void;

	/** 加载中：表体换成 4 行骨架，表头保留 */
	loading?: boolean;
	/** 非空时表体换成出错状态，优先级高于 loading；`message` 写在第二行 */
	error?: Error | null;
	/** 提供后出错状态带「重试」按钮 */
	onRetry?: () => void;

	/** 开启行多选，注入左侧固定的勾选列 */
	selectable?: boolean;
	/** 已选中行 id（受控）；不传则组件内部自管，均跨页保持 */
	selectedIds?: Set<string>;
	/** 选中态变更回调 */
	onSelectionChange?: (ids: Set<string>) => void;
	/** 批量操作区：有选中项时在表头原位淡入，盖住列名；不传则没有批量栏 */
	bulkActions?: ReactNode;
	/**
	 * 「选中全部 N 项」：整页选满且已选数小于 `totalSelectable` 时批量栏出现该按钮，点击后调用。
	 * 调用方负责把全部结果的 id 写进 `selectedIds`（可能需要请求）。不传则不提供该按钮。
	 */
	onSelectAll?: () => void;
	/** 全部结果中可被选中的总数，默认取 `pagination.total` */
	totalSelectable?: number;

	/** 开启行展开，注入左侧固定的展开列 */
	expandable?: boolean;
	/** 展开面板固定在可视区内、不随横向滚动移动；默认随表格滚动 */
	expandedRowFixed?: boolean;
	/** 已展开行 id（受控） */
	expandedRowKeys?: Set<string>;
	/** 展开态变更回调 */
	onExpandedChange?: (keys: Set<string>) => void;
	/** 展开面板内容；只在展开期间挂载 */
	renderExpandedRow?: (row: T) => ReactNode;

	/** 整行点击回调，提供后行显示手型光标 */
	onRowClick?: (row: T) => void;
	/** 根据行数据返回附加类名 */
	rowClassName?: (row: T) => string;

	/** 开启列宽拖拽（最小 `columnMinWidth`）；宽度记在 `storageKey` 下 */
	resizable?: boolean;
	/** 列最小宽度，默认 80 */
	columnMinWidth?: number;

	/** 表格上方的工具栏槽位（搜索、筛选、密度、导出），由调用方排布 */
	toolbar?: ReactNode;
	/**
	 * 列显隐与列宽记在这台设备（localStorage）的键前缀：显隐存在 `storageKey`，列宽存在
	 * `${storageKey}-widths-v2`。传了才出现表头左上角的「显示列」按钮。
	 */
	storageKey?: string;

	/** 当前处于筛选态：无数据时表体换成筛选后为空的状态 */
	filtered?: boolean;

	/** 行密度，默认 comfortable（表头 36、行 48）；compact 为表头 32、行 40 */
	density?: "comfortable" | "compact";
	/** 表格的可访问名称：渲染为 sr-only caption，同时命名横向滚动区域 */
	caption?: string;
	/** 空状态标题（`filtered` 为假） */
	emptyTitle?: string;
	/** 空状态说明（`filtered` 为假） */
	emptyDescription?: string;
	/** 空状态的主操作（如「写文章」按钮） */
	emptyAction?: ReactNode;
	/** 筛选后为空的标题，默认「没有匹配的结果」 */
	filteredTitle?: string;
	/** 筛选后为空的说明，默认「换个关键词，或者清除筛选」 */
	filteredDescription?: string;
	/** 筛选后为空的操作（如「清除筛选」按钮） */
	filteredAction?: ReactNode;
	/** 出错状态的标题（现状一句），默认「没能读取数据」 */
	errorTitle?: string;
	/**
	 * 内部浮层（显示列菜单、每页条数、单元格提示）的挂载容器，默认挂到 body；
	 * 同时作为判定「放不下」的边界。陈列室舞台与带缩放的宿主需要它。
	 */
	container?: HTMLElement | null;
	/** 根容器类名 */
	className?: string;
}

/** 选择列保留 key */
export const SELECT_COLUMN_KEY = "__select";
/** 展开列保留 key */
export const EXPAND_COLUMN_KEY = "__expand";
/** 无展开列时承载「显示列」按钮的独立首列保留 key */
export const COLUMNS_CONTROL_KEY = "__columns_control";

/** 勾选、展开、显示列这三种注入的窄列：宽度固定，不参与伸缩与持久化 */
export const isGutterKey = (key: string): boolean =>
	key === SELECT_COLUMN_KEY || key === EXPAND_COLUMN_KEY || key === COLUMNS_CONTROL_KEY;

/** 内容适配列：显式 `fitContent`，右固定列默认开启 */
export const isFitContent = <T>(col: DataTableColumn<T>): boolean =>
	col.fitContent ?? col.sticky === "right";
