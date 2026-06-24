import type { NavItem } from "@shared/config/nav";
import { Link } from "@tanstack/react-router";
import { cn } from "@shared/lib/utils";

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
 * - 文字提亮（neon-blue）
 * - 底色 accent
 * - 底部 2px neon 指示条（绝对定位，自身 box 内无 reflow）
 */
const HeaderNavItem = ({ item, onAction }: HeaderNavItemProps) => {
	if (item.type === "route") {
		return (
			<Link
				to={item.to}
				className={cn(BASE, "group")}
				// 选中态：neon 文字 + accent 底 + 底部指示条（覆盖到 className 之上）
				activeProps={{
					className:
						"text-neon-blue bg-accent [box-shadow:inset_0_-2px_0_hsl(var(--neon-blue))]",
				}}
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
