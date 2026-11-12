import { type ActiveNav, getNavItems, type NavItem, resolveActiveNav } from "@shared/config/nav";
import { useRouterState } from "@tanstack/react-router";
import { useMemo } from "react";
import { useNavTitle } from "./use-nav-title";

/** 顶栏导航随路由与登录态得出的状态。 */
export interface NavbarState {
	/** 当前登录态下可见的一级入口。 */
	items: NavItem[];
	/** 当前路径命中的导航位置。 */
	active: ActiveNav | null;
	/** 详情页声明的标题；非详情页为 null。 */
	title: string | null;
}

/**
 * 把路由位置、详情页标题与登录态整理成导航需要的状态。
 *
 * @param authenticated - SSR 已知的登录态，决定聊天等需登录入口是否出现
 */
export function useNavbarState(authenticated: boolean): NavbarState {
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const navTitle = useNavTitle();
	const items = useMemo(() => getNavItems({ authenticated }), [authenticated]);

	const active = resolveActiveNav(pathname, items);
	// location 先于 matches 更新：标题只在它所属页面仍是当前导航位置时生效
	const title =
		active && navTitle && resolveActiveNav(navTitle.path, items)?.item === active.item
			? navTitle.title
			: null;
	return { items, active, title };
}
