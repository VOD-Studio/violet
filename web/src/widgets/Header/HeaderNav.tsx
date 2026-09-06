import type { NavRouteItem } from "@shared/config/nav";
import { NAV_ITEMS } from "@shared/config/nav";
import { cn } from "@shared/lib/utils";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@shared/ui/base/dropdown-menu";
import { useRouterState } from "@tanstack/react-router";
import { ChevronDown, LayoutGrid } from "lucide-react";
import { useState } from "react";

import HeaderNavItem from "./HeaderNavItem";

export interface HeaderNavProps {
	onAction?: (action: string) => void;
}

/**
 * HeaderNav - 悬浮主导航船坞（Nav Dock Capsule）
 *
 * 对齐三段式悬浮胶囊设计，主导航横排，次级导航收纳至"更多"下拉网格。
 * 严禁 scale 变形，纯色/高斯模糊过渡。
 */
const HeaderNav = ({ onAction }: HeaderNavProps) => {
	const primaryItems = NAV_ITEMS.filter(
		(item): item is NavRouteItem => item.type === "route" && Boolean(item.primary),
	);
	const secondaryItems = NAV_ITEMS.filter((item) => item.type !== "route" || !item.primary);
	const [browseOpen, setBrowseOpen] = useState(false);
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const secondaryActive = secondaryItems.some(
		(item) => item.type === "route" && matchesRoute(pathname, item),
	);

	return (
		<nav
			aria-label="主导航"
			className="pointer-events-auto relative hidden h-10 items-center gap-1 rounded-full border border-border/60 bg-background/80 px-1.5 py-1 shadow-xs backdrop-blur-md lg:flex dark:bg-card/85"
		>
			{primaryItems.map((item) => (
				<HeaderNavItem key={item.label} item={item} onAction={onAction} />
			))}

			{secondaryItems.length > 0 && (
				<DropdownMenu open={browseOpen} onOpenChange={setBrowseOpen}>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							aria-label="更多页面"
							aria-current={secondaryActive ? "page" : undefined}
							className={cn(
								"group flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-colors",
								secondaryActive || browseOpen
									? "bg-foreground text-background shadow-xs"
									: "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
							)}
						>
							<LayoutGrid className="size-3.5 shrink-0" />
							<span>更多</span>
							<ChevronDown
								className={cn(
									"size-3 shrink-0 transition-transform duration-200",
									browseOpen && "rotate-180",
								)}
							/>
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						align="center"
						sideOffset={10}
						className="w-88 rounded-2xl border border-border/80 bg-popover/95 p-2 shadow-xl backdrop-blur-md"
					>
						<div className="flex items-center justify-between px-2.5 py-1.5">
							<span className="font-mono text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
								Explore / 探索
							</span>
						</div>
						<div className="grid grid-cols-2 gap-1">
							{secondaryItems.map((item) => (
								<HeaderNavItem
									key={item.label}
									item={item}
									onAction={onAction}
									onNavigate={() => setBrowseOpen(false)}
									detailed
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
