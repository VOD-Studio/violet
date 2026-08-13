import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/base/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@shared/ui/base/tooltip";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { AdminBrand } from "./AdminBrand";
import { useAdminSidebarStore } from "./admin-sidebar-store";
import { NavMenu } from "./nav-menu/NavMenu";

/**
 * AdminSidebar - 桌面侧边栏
 *
 * hidden md:flex，移动端由 AdminMobileNav 接管。语义色 token，
 * 随全局主题自动切换。品牌区（AdminBrand）+ 分组菜单（NavMenu）
 * + 底部返回前台。
 *
 * 支持收起模式（w-64 ↔ w-16，状态 persist 到 localStorage）：收起后
 * 品牌区仅徽章、菜单仅图标（Tooltip 显示名称）、组标题退化为分隔线。
 * 折叠按钮为悬浮球，钉在右缘品牌区中线高度，两态位置一致，随宽度动画
 * 平滑移动；文字用 max-w/opacity 过渡，随宽度自然收展不挤压。
 */
export function AdminSidebar() {
	const collapsed = useAdminSidebarStore((s) => s.collapsed);
	const toggle = useAdminSidebarStore((s) => s.toggle);

	// FLIP：宽度瞬时切换（一次重排），内容区用 translateX 反向补偿做滑动。
	// transform 走合成器，滑动期间内容零逐帧 reflow/paint——宽度过渡会让
	// 大表格页（如权限管理全展开）每帧按新宽度重排重绘，造成掉帧。
	const handleToggle = () => {
		const content = document.getElementById("admin-content");
		content?.getAnimations().forEach((a) => {
			a.cancel();
		});
		const before = content?.getBoundingClientRect().left ?? 0;
		toggle();
		if (!content) return;
		requestAnimationFrame(() => {
			const delta = before - content.getBoundingClientRect().left;
			if (delta === 0) return;
			// 强制提升为合成层：transform 动画才能走合成器，
			// 否则逐帧主线程重绘大子树，等同退回到原掉帧。
			content.style.willChange = "transform";
			const anim = content.animate(
				[{ transform: `translateX(${delta}px)` }, { transform: "translateX(0)" }],
				{ duration: 200, easing: "ease-out" },
			);
			anim.finished
				.catch(() => {})
				.finally(() => {
					content.style.willChange = "";
				});
		});
	};

	return (
		<TooltipProvider delayDuration={200}>
			<aside
				className={cn(
					"relative hidden shrink-0 flex-col border-r bg-card md:flex",
					collapsed ? "w-16" : "w-64",
				)}
			>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="outline"
							size="icon"
							onClick={handleToggle}
							aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
							className="bg-background absolute top-7 -right-3.5 z-40 size-7 -translate-y-1/2 rounded-full shadow-sm"
						>
							{collapsed ? (
								<PanelLeftOpen className="size-3.5" />
							) : (
								<PanelLeftClose className="size-3.5" />
							)}
						</Button>
					</TooltipTrigger>
					<TooltipContent side="right">
						{collapsed ? "展开侧边栏" : "收起侧边栏"}
					</TooltipContent>
				</Tooltip>
				<AdminBrand collapsed={collapsed} />
				<div className="flex-1 overflow-x-hidden overflow-y-auto p-3">
					<NavMenu collapsed={collapsed} />
				</div>
				<div
					className={cn(
						"flex items-center border-t p-3",
						collapsed ? "justify-center" : "justify-between",
					)}
				>
					<Link
						to="/"
						aria-label="返回前台"
						className={cn(
							"text-muted-foreground hover:bg-accent hover:text-accent-foreground flex items-center rounded-md py-2 text-sm font-medium transition-colors",
							collapsed ? "justify-center px-2" : "gap-2 px-3",
						)}
					>
						<ArrowLeft className="size-4 shrink-0" />
						<span
							className={cn(
								"overflow-hidden whitespace-nowrap transition-all duration-200",
								collapsed ? "max-w-0 opacity-0" : "max-w-40 opacity-100",
							)}
						>
							返回前台
						</span>
					</Link>
					{!collapsed && (
						<span className="text-muted-foreground/60 px-3 text-xs">v2.0</span>
					)}
				</div>
			</aside>
		</TooltipProvider>
	);
}
