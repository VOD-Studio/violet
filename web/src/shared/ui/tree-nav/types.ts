import type { ReactNode } from "react";

/**
 * 树形导航支持的最大深度层级（最多 4 级）。
 */
export const MAX_TREE_NAV_DEPTH = 4;

/**
 * 树形导航节点项，支持最多 4 级嵌套。
 */
export interface TreeNavItem {
	/** 节点唯一标识 */
	id: string;
	/** 节点文本标题 */
	title: string;
	/** 跳转路由或目标链接 */
	to?: string;
	/** 标号或微标（例如章节号 '柒'、版本号、角标等） */
	badge?: ReactNode;
	/** 子节点列表（最多支持嵌套至第 4 级） */
	children?: TreeNavItem[];
	/** 是否禁用 */
	disabled?: boolean;
}

/**
 * 树形导航分组。
 */
export interface TreeNavGroup {
	/** 分组唯一标识 */
	id: string;
	/** 分组标题（如 '卷一 · 纲纪准则'） */
	title: string;
	/** 分组下的导航条目 */
	items: TreeNavItem[];
}

/**
 * TreeNav 根组件属性。
 */
export interface TreeNavProps {
	/** 当前路由路径 */
	currentPath: string;
	/** 树形导航分组列表 */
	groups?: TreeNavGroup[];
	/** 单一展平的条目列表（当无需分组标题时传入） */
	items?: TreeNavItem[];
	/** 导航点击回调 */
	onNavigate?: () => void;
	/** 自定义最外层类名 */
	className?: string;
	/** 自定义全树共享流体滑块的 layoutId（默认 'tree-nav-fluid-indicator'） */
	fluidLayoutId?: string;
	/** 是否默认全部展开（默认仅自动展开当前活跃分支） */
	defaultExpandAll?: boolean;
	/** 导航区域可访问性标签，默认 '目录导航' */
	ariaLabel?: string;
}
