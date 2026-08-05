/**
 * NavRouteItem - 路由类型 nav 项
 */
export interface NavRouteItem {
	/** 类型标识：路由跳转 */
	type: "route";
	/** 显示文案 */
	label: string;
	/** 路由路径 */
	to: string;
	/** 是否精确匹配当前路由以激活高亮，默认 false */
	exact?: boolean;
}

/**
 * NavActionItem - 动作类型 nav 项（不导航，触发全局事件）
 */
export interface NavActionItem {
	/** 类型标识：动作 */
	type: "action";
	/** 显示文案 */
	label: string;
	/** 动作标识，由消费方自行解释（如 open-music） */
	action: string;
}

/**
 * NavItem - nav 项联合类型
 */
export type NavItem = NavRouteItem | NavActionItem;

/**
 * NAV_ITEMS - nav 项定义（单一来源）
 *
 * Header 桌面 nav 与移动端 Sheet 共用此配置。
 * type 区分：
 * - route：TanStack Router 跳转
 * - action：触发全局事件（如打开音乐播放器，不导航）
 */
export const NAV_ITEMS: NavItem[] = [
	{ type: "route", label: "首页", to: "/", exact: true },
	{ type: "route", label: "博客", to: "/blog", exact: true },
	{ type: "route", label: "归档", to: "/blog/archive" },
	{ type: "route", label: "项目", to: "/projects" },
	{ type: "route", label: "关于", to: "/about" },
];
