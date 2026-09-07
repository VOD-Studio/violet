import type { NavItem, NavRouteItem } from "@shared/config/nav";
import { cn } from "@shared/lib/utils";
import { Link, useRouterState } from "@tanstack/react-router";

export interface HeaderNavItemProps {
	item: NavItem;
	onAction?: (action: string) => void;
	onNavigate?: () => void;
	className?: string;
	detailed?: boolean;
	activeStyle?: "background" | "text";
}

/**
 * HeaderNavItem - 单个导航项
 *
 * 支持胶囊模式（桌面端微岛导航，带图标与标签）与详情模式（下拉菜单/移动抽屉）。
 * 严禁 scale 变形。
 */
const HeaderNavItem = ({
	item,
	onAction,
	onNavigate,
	className,
	detailed = false,
}: HeaderNavItemProps) => {
	if (item.type === "route") {
		return (
			<NavLinkActive
				item={item}
				className={className}
				detailed={detailed}
				onNavigate={onNavigate}
			/>
		);
	}
	const Icon = item.icon;
	return (
		<button
			type="button"
			onClick={() => onAction?.(item.action)}
			className={cn(
				detailed
					? "group flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-muted/70 text-foreground"
					: "flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground",
				className,
			)}
		>
			<Icon className={cn(detailed ? "size-4 shrink-0" : "size-3.5 shrink-0")} />
			<span>{item.label}</span>
		</button>
	);
};

const NavLinkActive = ({
	item,
	className,
	detailed,
	onNavigate,
}: {
	item: NavRouteItem;
	className?: string;
	detailed: boolean;
	onNavigate?: () => void;
}) => {
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const exact = item.exact ?? false;
	const isActive = exact
		? pathname === item.to
		: pathname === item.to || pathname.startsWith(`${item.to}/`);
	const Icon = item.icon;

	if (!detailed) {
		return (
			<Link
				to={item.to}
				onClick={onNavigate}
				aria-current={isActive ? "page" : undefined}
				className={cn(
					"group flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors",
					isActive
						? "bg-foreground text-background shadow-xs"
						: "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
					className,
				)}
			>
				<Icon className="size-3.5 shrink-0" />
				<span>{item.label}</span>
			</Link>
		);
	}

	return (
		<Link
			to={item.to}
			onClick={onNavigate}
			aria-current={isActive ? "page" : undefined}
			className={cn(
				"group flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors",
				isActive
					? "bg-foreground text-background hover:bg-foreground hover:text-background"
					: "hover:bg-muted/70 text-foreground",
				className,
			)}
		>
			<span
				className={cn(
					"flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background text-muted-foreground transition-colors",
					isActive && "border-background/20 bg-background/10 text-background",
				)}
			>
				<Icon className="size-4" />
			</span>
			<span className="min-w-0 text-left">
				<span className="block text-xs font-semibold leading-none">{item.label}</span>
				<span
					className={cn(
						"mt-1 block truncate text-[11px] font-normal text-muted-foreground",
						isActive && "text-background/75",
					)}
				>
					{item.description}
				</span>
			</span>
		</Link>
	);
};
export default HeaderNavItem;
