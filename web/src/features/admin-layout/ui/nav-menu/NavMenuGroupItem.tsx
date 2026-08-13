import { cn } from "@shared/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@shared/ui/base/popover";
import { useRouterState } from "@tanstack/react-router";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { useAdminSidebarStore } from "../admin-sidebar-store";
import { NAV_ITEM_ACTIVE, NAV_ITEM_BASE, NavMenuLink } from "./NavMenuLink";
import type { NavMenuItem } from "./nav-menu-config";

/**
 * NavMenuGroupItem - 带子菜单的父项
 * 父项是纯分组容器：点按只切换展开/折叠，不导航（避免无意义的父级页面）。
 * 子项缩进渲染，默认折叠，用户手动点按后展开/收起。
 *
 * 子路由命中（如 /admin/settings/general）时父项显示激活态，但仅当子项
 * 不可见时（侧边栏收起 / 分组未展开）——子项可见时激活态由子项自身承担，
 * 避免父子两行重复高亮。前缀判定用 `to + "/"`，防止 /admin/settings 误命中
 * /admin/settings-x 这类同前缀路由。
 *
 * collapsed（侧边栏收起）时：子项无法内联渲染（撑破窄栏），点按图标改为
 * 右侧 Popover 飞出子菜单，子项导航后自动关闭；图标在子路由命中时保持激活态。
 */
export function NavMenuGroupItem({
	item,
	onNavigate,
	collapsed = false,
}: {
	item: NavMenuItem;
	onNavigate?: () => void;
	collapsed?: boolean;
}) {
	const setGroupExpanded = useAdminSidebarStore((s) => s.setGroupExpanded);
	const expandedGroups = useAdminSidebarStore((s) => s.expandedGroups);
	// 用户手动操作优先；未操作时默认折叠。
	const manualState = expandedGroups[item.to];
	const expanded = manualState ?? false;

	const [flyoutOpen, setFlyoutOpen] = useState(false);
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const childActive = pathname === item.to || pathname.startsWith(`${item.to}/`);
	const showActive = childActive && (collapsed || !expanded);

	const Icon: LucideIcon = item.icon;
	const trigger = (
		<button
			type="button"
			aria-expanded={collapsed ? flyoutOpen : expanded}
			onClick={
				collapsed
					? undefined // Popover 接管开关，不动 expandedGroups（收起态子项不内联渲染）
					: () => setGroupExpanded(item.to, !expanded)
			}
			className={cn(
				NAV_ITEM_BASE,
				"w-full",
				collapsed && "justify-center gap-0 px-0",
				showActive && NAV_ITEM_ACTIVE,
			)}
		>
			<Icon className="size-4 shrink-0" />
			<span
				className={cn(
					"flex-1 overflow-hidden text-left transition-all duration-200",
					collapsed ? "max-w-0 opacity-0" : "max-w-40 opacity-100",
				)}
			>
				{item.label}
			</span>
			{!collapsed && (
				<ChevronDown
					className={cn(
						"size-4 shrink-0 text-muted-foreground transition-transform",
						expanded && "rotate-180",
					)}
				/>
			)}
		</button>
	);

	if (collapsed) {
		return (
			<Popover open={flyoutOpen} onOpenChange={setFlyoutOpen}>
				<PopoverTrigger asChild>{trigger}</PopoverTrigger>
				<PopoverContent side="right" align="start" sideOffset={8} className="w-44 p-1.5">
					<p className="text-muted-foreground/60 px-3 pt-1.5 pb-1 text-xs font-medium tracking-wider">
						{item.label}
					</p>
					<div className="flex flex-col gap-0.5">
						{item.children?.map((child) => (
							<NavMenuLink
								key={child.to}
								item={child}
								onNavigate={() => {
									setFlyoutOpen(false);
									onNavigate?.();
								}}
							/>
						))}
					</div>
				</PopoverContent>
			</Popover>
		);
	}

	return (
		<div className="flex flex-col">
			{trigger}
			{expanded && item.children && (
				<div className="ml-3 mt-0.5 flex flex-col gap-0.5 border-l pl-2">
					{item.children.map((child) => (
						<NavMenuLink
							key={child.to}
							item={child}
							onNavigate={onNavigate}
							collapsed={false}
						/>
					))}
				</div>
			)}
		</div>
	);
}
