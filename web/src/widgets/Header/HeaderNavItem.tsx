import type { NavItem } from "@shared/config/nav";
import { cn } from "@shared/lib/utils";
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
 * nav 项基础样式：圆角胶囊 + hover 底色；选中态由 activeProps / aria 叠加。
 */
const BASE =
	"relative rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";

/**
 * HeaderNavItem - 单个 nav 项
 *
 * 根据 item.type 渲染为 Link（route）或 button（action）。
 * route 项用 TanStack Router 的 activeProps 高亮当前路由：
 * 文字提亮为 foreground + accent 底色（克制，无强调色装饰）。
 */
const HeaderNavItem = ({ item, onAction }: HeaderNavItemProps) => {
	if (item.type === "route") {
		return (
			<Link
				to={item.to}
				className={cn(BASE, "group")}
				activeProps={{ className: "text-foreground bg-accent" }}
				activeOptions={{ exact: item.to === "/" }}
			>
				{item.label}
			</Link>
		);
	}
	return (
		<button type="button" onClick={() => onAction?.(item.action)} className={BASE}>
			{item.label}
		</button>
	);
};

export default HeaderNavItem;
