import { flattenNavLinks, type NavItem, type NavLink } from "@shared/config/nav";
import { PRIMARY_TAB_COUNT } from "./metrics";

export type RoutableNavItem = NavItem & { to: string };

/** 岛上随登录态变化的导航数据。 */
export interface IslandNav {
	/** 当前登录态下可见的顶层项。 */
	items: NavItem[];
	/** 全部可跳转目标（含二级项，按 `to` 去重）。 */
	links: NavLink[];
	/** 收起态常驻的主要入口。 */
	primaryTabs: RoutableNavItem[];
	/** 面板「全部」区：有目标的顶层项在前，不与父项重复的二级项（如「归档」）排在其后。 */
	panelLinks: NavLink[];
	/** 面板里按分组列出的纯分组项。 */
	panelGroups: NavItem[];
}

export function buildIslandNav(items: NavItem[]): IslandNav {
	const routable = items.filter((item): item is RoutableNavItem => item.to !== undefined);
	return {
		items,
		links: flattenNavLinks(items),
		primaryTabs: routable.slice(0, PRIMARY_TAB_COUNT),
		panelLinks: [
			...routable,
			...routable.flatMap((item) =>
				(item.children ?? []).filter((child) => child.to !== item.to),
			),
		],
		panelGroups: items.filter((item) => item.to === undefined && item.children),
	};
}
