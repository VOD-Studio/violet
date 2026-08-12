import { cn } from "@shared/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@shared/ui/base/tooltip";
import { Link } from "@tanstack/react-router";
import type { NavMenuItem } from "./nav-menu-config";

export const NAV_ITEM_BASE =
	"relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground";

/** 激活态：底色高亮 + 左侧指示条（before 伪元素，不挤压布局） */
export const NAV_ITEM_ACTIVE =
	"bg-accent text-accent-foreground before:absolute before:left-0 before:top-1/2 before:h-4 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-primary before:content-['']";

/** 单个菜单项（顶级项与分组项共用渲染）；collapsed 时仅图标 + 右侧 Tooltip */
export function NavMenuLink({
	item,
	onNavigate,
	collapsed = false,
}: {
	item: NavMenuItem;
	onNavigate?: () => void;
	collapsed?: boolean;
}) {
	const Icon = item.icon;
	const ItemBadge = item.badge;
	const link = (
		<Link
			to={item.to}
			activeOptions={{ exact: item.exact ?? false }}
			activeProps={{ className: NAV_ITEM_ACTIVE }}
			className={cn(NAV_ITEM_BASE, "group", collapsed && "justify-center gap-0 px-0")}
			onClick={onNavigate}
		>
			<Icon className="size-4 shrink-0" />
			<span
				className={cn(
					"overflow-hidden transition-all duration-200",
					collapsed ? "max-w-0 opacity-0" : "max-w-40 opacity-100",
				)}
			>
				{item.label}
			</span>
			{ItemBadge ? <ItemBadge collapsed={collapsed} /> : null}
		</Link>
	);
	if (!collapsed) return link;
	return (
		<Tooltip>
			<TooltipTrigger asChild>{link}</TooltipTrigger>
			<TooltipContent side="right">{item.label}</TooltipContent>
		</Tooltip>
	);
}
