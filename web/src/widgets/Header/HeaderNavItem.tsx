import type { NavItem, NavRouteItem } from "@shared/config/nav";
import { cn } from "@shared/lib/utils";
import { Link, useRouterState } from "@tanstack/react-router";

/**
 * HeaderNavItemProps - HeaderNavItem 组件属性
 */
export interface HeaderNavItemProps {
	item: NavItem;
	onAction?: (action: string) => void;
	className?: string;
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
const HeaderNavItem = ({ item, onAction, className }: HeaderNavItemProps) => {
	if (item.type === "route") {
		return <NavLinkActive item={item} className={className} />;
	}
	return (
		<button
			type="button"
			onClick={() => onAction?.(item.action)}
			className={cn(BASE, className)}
		>
			{item.label}
		</button>
	);
};

const NavLinkActive = ({ item, className }: { item: NavRouteItem; className?: string }) => {
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const exact = item.exact ?? false;
	const isActive = exact
		? pathname === item.to
		: pathname === item.to || pathname.startsWith(`${item.to}/`);

	return (
		<Link
			to={item.to}
			aria-current={isActive ? "page" : undefined}
			className={cn(BASE, "group", isActive && "bg-accent text-foreground", className)}
		>
			{item.label}
		</Link>
	);
};
export default HeaderNavItem;
