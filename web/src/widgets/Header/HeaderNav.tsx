import type { NavRouteItem } from "@shared/config/nav";
import { NAV_ITEMS } from "@shared/config/nav";
import { cn } from "@shared/lib/utils";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@shared/ui/base/dropdown-menu";
import type { SegmentedItem } from "@shared/ui/segmented";
import { Segmented } from "@shared/ui/segmented";
import { useRouterState } from "@tanstack/react-router";
import { ChevronDown, LayoutGrid } from "lucide-react";
import { useState } from "react";

import HeaderNavItem from "./HeaderNavItem";

/** 配置主导航非路由项的行为。 */
export interface HeaderNavProps {
	/** 触发非路由项时接收其动作标识。 */
	onAction?: (action: string) => void;
}

/** 渲染主导航分段与次级页面菜单。 */
const HeaderNav = ({ onAction }: HeaderNavProps) => {
	const primaryItems = NAV_ITEMS.filter(
		(item): item is NavRouteItem => item.type === "route" && Boolean(item.primary),
	);
	const secondaryItems = NAV_ITEMS.filter((item) => item.type !== "route" || !item.primary);
	const [browseOpen, setBrowseOpen] = useState(false);
	const pathname = useRouterState({ select: (state) => state.location.pathname });

	const activePrimary = primaryItems.find((item) => matchesRoute(pathname, item));
	const activeSecondary = secondaryItems.find(
		(item): item is NavRouteItem => item.type === "route" && matchesRoute(pathname, item),
	);

	const activeValue = activePrimary ? activePrimary.to : "";

	const segments: SegmentedItem[] = primaryItems.map((item) => {
		const Icon = item.icon;
		return {
			value: item.to,
			to: item.to,
			label: (
				<span className="flex items-center gap-1.5">
					<Icon className="size-3.5 shrink-0" />
					<span>{item.label}</span>
				</span>
			),
		};
	});

	return (
		<nav
			aria-label="主导航"
			className="pointer-events-auto relative hidden h-10 items-center gap-1 rounded-full border border-border/60 bg-background/80 px-0.75 py-1 shadow-xs backdrop-blur-md lg:flex dark:bg-card/85"
		>
			<Segmented
				value={activeValue}
				onValueChange={() => {}}
				segments={segments}
				rounded="full"
				size="sm"
				indicatorClassName="bg-foreground shadow-none ring-0"
				activeItemClassName="font-semibold text-background"
				itemClassName="rounded-full px-3 text-xs transition-colors duration-150"
			/>

			{secondaryItems.length > 0 && (
				<DropdownMenu open={browseOpen} onOpenChange={setBrowseOpen}>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							aria-label={
								activeSecondary ? `${activeSecondary.label} 等更多页面` : "更多页面"
							}
							aria-current={activeSecondary ? "page" : undefined}
							className={cn(
								"group flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-colors",
								activeSecondary || browseOpen
									? "bg-foreground text-background shadow-xs"
									: "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
							)}
						>
							{activeSecondary ? (
								<>
									<activeSecondary.icon className="size-3.5 shrink-0" />
									<span>{activeSecondary.label}</span>
								</>
							) : (
								<>
									<LayoutGrid className="size-3.5 shrink-0" />
									<span>更多</span>
								</>
							)}
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
