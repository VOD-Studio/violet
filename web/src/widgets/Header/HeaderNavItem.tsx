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

const BASE =
	"relative rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";

/**
 * HeaderNavItem - 单个 nav 项
 *
 * 根据 item.type 渲染为 Link（route）或 button（action）。
 * route 项激活态用显式 pathname 判定（见 NavLinkActive）。
 */
const HeaderNavItem = ({
	item,
	onAction,
	onNavigate,
	className,
	detailed = false,
	activeStyle = "background",
}: HeaderNavItemProps) => {
	if (item.type === "route") {
		return (
			<NavLinkActive
				item={item}
				className={className}
				detailed={detailed}
				onNavigate={onNavigate}
				activeStyle={activeStyle}
			/>
		);
	}
	const Icon = item.icon;
	return (
		<button
			type="button"
			onClick={() => onAction?.(item.action)}
			className={cn(BASE, className)}
		>
			{detailed && <Icon className="size-4 shrink-0" />}
			<span>{item.label}</span>
		</button>
	);
};

const NavLinkActive = ({
	item,
	className,
	detailed,
	onNavigate,
	activeStyle,
}: {
	item: NavRouteItem;
	className?: string;
	detailed: boolean;
	onNavigate?: () => void;
	activeStyle: "background" | "text";
}) => {
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const exact = item.exact ?? false;
	const isActive = exact
		? pathname === item.to
		: pathname === item.to || pathname.startsWith(`${item.to}/`);
	const Icon = item.icon;

	return (
		<Link
			to={item.to}
			onClick={onNavigate}
			aria-current={isActive ? "page" : undefined}
			className={cn(
				BASE,
				"group",
				detailed &&
					isActive &&
					"bg-foreground text-background hover:bg-foreground hover:text-background",
				!detailed && activeStyle === "text" && isActive && "text-background",
				className,
			)}
		>
			{!detailed && <span className="relative">{item.label}</span>}
			{detailed && (
				<>
					<span
						className={cn(
							"flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background text-muted-foreground",
							isActive && "border-background/20 bg-background/10 text-background",
						)}
					>
						<Icon className="size-4" />
					</span>
					<span className="min-w-0 text-left">
						<span className="block text-sm font-semibold">{item.label}</span>
						<span
							className={cn(
								"mt-0.5 block truncate text-xs font-normal text-muted-foreground",
								isActive && "text-background/70",
							)}
						>
							{item.description}
						</span>
					</span>
				</>
			)}
		</Link>
	);
};
export default HeaderNavItem;
