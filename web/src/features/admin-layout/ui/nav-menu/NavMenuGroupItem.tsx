import { cn } from "@shared/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@shared/ui/base/popover";
import { useRouterState } from "@tanstack/react-router";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
 *
 * 展开动画 grid-rows 0fr↔1fr 高度过渡；分组位于滚动区底部时展开内容会
 * 溢出可视区，effect 里 scrollIntoView(nearest) 把子菜单滚进视野。
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
	const submenuRef = useRef<HTMLDivElement>(null);
	const pathname = useRouterState({ select: (s) => s.location.pathname });

	// 展开时把子菜单滚进视野（底部组展开后内容溢出滚动区可视范围）。
	// 必须等 grid-rows 过渡结束再滚：effect 触发时容器仍是 0fr 收起态几何，
	// nearest 判定「已可见」会跳过滚动。transitionend 只在值变化时触发，
	// 期间被收起则 cleanup 摘除监听，不误滚。
	// scrollIntoView/matchMedia 判存在：jsdom 均未实现，测试环境跳过。
	useEffect(() => {
		if (!expanded || collapsed) return;
		const el = submenuRef.current;
		if (!el || typeof el.scrollIntoView !== "function") return;
		const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
		if (reduce) {
			el.scrollIntoView({ block: "nearest", behavior: "auto" });
			return;
		}
		const onEnd = (e: TransitionEvent) => {
			if (e.propertyName === "grid-template-rows") {
				el.scrollIntoView({ block: "nearest", behavior: "smooth" });
			}
		};
		el.addEventListener("transitionend", onEnd);
		return () => el.removeEventListener("transitionend", onEnd);
	}, [expanded, collapsed]);
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
			{/* 子菜单：grid-rows 0fr↔1fr 高度过渡（同 OAuthProviderCard 先例），展开/收起不跳布局；
			    data-state 供测试断言可见性；visibility 随过渡切换，收起后子项不可被 tab 聚焦 */}
			<div
				ref={submenuRef}
				data-state={expanded ? "open" : "closed"}
				className={cn(
					"grid transition-[grid-template-rows,margin-top,opacity,visibility] duration-300 ease-out motion-reduce:transition-none",
					expanded
						? "mt-0.5 grid-rows-[1fr] opacity-100 visible"
						: "mt-0 grid-rows-[0fr] opacity-0 invisible",
				)}
			>
				<div className="ml-3 min-h-0 overflow-hidden pl-2">
					<div className="flex flex-col gap-0.5 border-l">
						{item.children?.map((child) => (
							<NavMenuLink
								key={child.to}
								item={child}
								onNavigate={onNavigate}
								collapsed={false}
							/>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
