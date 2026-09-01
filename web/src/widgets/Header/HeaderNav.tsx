import type { NavRouteItem } from "@shared/config/nav";
import { NAV_ITEMS } from "@shared/config/nav";
import { cn } from "@shared/lib/utils";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@shared/ui/base/dropdown-menu";
import { useRouterState } from "@tanstack/react-router";
import { LayoutGrid } from "lucide-react";

import HeaderNavItem from "./HeaderNavItem";

export interface HeaderNavProps {
	onAction?: (action: string) => void;
}
const HeaderNav = ({ onAction }: HeaderNavProps) => {
	const primaryItems = NAV_ITEMS.filter((item) => item.type === "route" && item.primary);
	const secondaryItems = NAV_ITEMS.filter((item) => item.type !== "route" || !item.primary);
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const secondaryActive = secondaryItems.some(
		(item) => item.type === "route" && matchesRoute(pathname, item),
	);

	return (
		<nav
			aria-label="主导航"
			className="hidden items-center rounded-xl border border-border/60 bg-background/60 p-1 shadow-sm shadow-black/5 lg:flex dark:shadow-black/20"
		>
			{primaryItems.map((item) => (
				<HeaderNavItem key={item.label} item={item} onAction={onAction} />
			))}
			{secondaryItems.length > 0 && (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							aria-current={secondaryActive ? "page" : undefined}
							className={cn(
								"group ml-1 flex items-center gap-1.5 rounded-lg border-l border-border/60 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[state=open]:bg-foreground data-[state=open]:text-background",
								secondaryActive &&
									"bg-foreground text-background hover:bg-foreground hover:text-background",
							)}
						>
							<LayoutGrid className="size-3.5" />
							浏览
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						align="center"
						sideOffset={10}
						className="w-88 rounded-2xl border-border/60 p-2 shadow-xl shadow-black/10"
					>
						<div className="px-2 pb-2 pt-1">
							<p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
								更多内容
							</p>
						</div>
						<div className="grid grid-cols-2 gap-1">
							{secondaryItems.map((item) => (
								<HeaderNavItem
									key={item.label}
									item={item}
									onAction={onAction}
									detailed
									className="flex min-w-0 items-center gap-3 px-2.5 py-2.5"
								/>
							))}
						</div>
					</DropdownMenuContent>
				</DropdownMenu>
			)}
		</nav>
	);
};

const matchesRoute = (pathname: string, item: NavRouteItem) =>
	item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);

export default HeaderNav;
