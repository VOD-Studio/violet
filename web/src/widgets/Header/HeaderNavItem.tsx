import type { NavItem } from "@shared/config/nav";
import { Link } from "@tanstack/react-router";

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
 * HeaderNavItem - 单个 nav 项
 *
 * 根据 item.type 渲染为 Link（route）或 button（action）。
 * route 项用 TanStack Router 的 activeProps 高亮当前路由。
 */
const HeaderNavItem = ({ item, onAction }: HeaderNavItemProps) => {
	if (item.type === "route") {
		return (
			<Link
				to={item.to}
				className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
				activeProps={{ className: "text-foreground" }}
				activeOptions={{ exact: item.to === "/" }}
			>
				{item.label}
			</Link>
		);
	}
	return (
		<button
			type="button"
			onClick={() => onAction?.(item.action)}
			className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
		>
			{item.label}
		</button>
	);
};

export default HeaderNavItem;
