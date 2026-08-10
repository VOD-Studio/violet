import type { NavItem, NavRouteItem } from "@shared/config/nav";
import { cn } from "@shared/lib/utils";
import { Link } from "@tanstack/react-router";
import { useSyncExternalStore } from "react";

/**
 * HeaderNavItemProps - HeaderNavItem 组件属性
 */
export interface HeaderNavItemProps {
	/**
	 * nav 项配置（route 或 action）
	 */
	item: NavItem;
	/**
	 * 点击 action 项时的回调（Header 解释 action 标识，如 open-music）
	 */
	onAction?: (action: string) => void;
}

/**
 * nav 项基础样式：圆角胶囊 + hover 底色；选中态由 activeProps / aria 叠加。
 */
const BASE =
	"relative rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";

/**
 * HeaderNavItem - 单个 nav 项
 *
 * 根据 item.type 渲染为 Link（route）或 button（action）。
 * route 项激活态用显式 pathname 判定（见 NavLinkActive）。
 */
const HeaderNavItem = ({ item, onAction }: HeaderNavItemProps) => {
	if (item.type === "route") {
		return <NavLinkActive item={item} />;
	}
	return (
		<button type="button" onClick={() => onAction?.(item.action)} className={BASE}>
			{item.label}
		</button>
	);
};

/**
 * NavLinkActive - 用显式 pathname 判定激活态。
 *
 * TanStack Router 的 activeProps 在「ssr:false 页 beforeLoad throw redirect + 整页刷新」
 * 场景下 active 状态丢失（如已登录时整页刷新 /login，redirect 到 / 后首页 nav 不激活）。
 * useRouterState 同样滞后。用 window.location.pathname 作 ground truth：redirect 完成后
 * 地址栏准确，popstate 订阅 + router 变化触发同步。
 */
const NavLinkActive = ({ item }: { item: NavRouteItem }) => {
	// useRouterState 在「整页刷新 + beforeLoad redirect」场景下 pathname 滞后,
	// 导致 redirect 后 nav 不激活。useSyncExternalStore 订阅 popstate 事件
	// 直接读 window.location.pathname(redirect 后地址栏是 ground truth),
	// 事件触发即重渲染,不依赖 router 内部 store 通知。
	const pathname = useSyncExternalStore(
		subscribePopState,
		() => window.location.pathname,
		() => "", // SSR 快照返回空串：不匹配任何 to，hydration 前全部不激活，避免刷新瞬间 nav 全选
	);
	const exact = item.exact ?? false;
	const isActive = exact
		? pathname === item.to
		: pathname === item.to || pathname.startsWith(`${item.to}/`);
	return (
		<Link to={item.to} className={cn(BASE, "group", isActive && "text-foreground bg-accent")}>
			{item.label}
		</Link>
	);
};

const subscribePopState = (onChange: () => void) => {
	window.addEventListener("popstate", onChange);
	return () => window.removeEventListener("popstate", onChange);
};

export default HeaderNavItem;
