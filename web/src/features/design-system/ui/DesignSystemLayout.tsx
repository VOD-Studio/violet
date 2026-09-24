import { PageShell } from "@shared/ui/page-shell";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { findNavItemByPath } from "../model/navigation";
import { DesignSystemMobileNav } from "./DesignSystemMobileNav";
import { DesignSystemPagination } from "./DesignSystemPagination";
import { DesignSystemSidebar } from "./DesignSystemSidebar";

/**
 * 营造法式前台多路由布局：
 * 桌面端（md:）：双栏典籍排版，左侧目录 Sticky 停驻，不随右侧滚动；
 * 移动端（< md）：专属大拇指悬浮灵动岛交互导航；
 * 彻底杜绝全局或局部白屏闪烁，保持极速原位交接。
 */
export function DesignSystemLayout() {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const activeItem = findNavItemByPath(pathname);

	return (
		<PageShell className="font-serif pt-4 sm:pt-8">
			{/* 移动端专属悬浮导航 */}
			<DesignSystemMobileNav activeItem={activeItem} currentPath={pathname} />

			{/* 桌面端与平板双栏布局 */}
			<div className="flex flex-col md:flex-row md:gap-10 lg:gap-14">
				{/* 桌面端专属左侧目录：吸附在视口顶端，不随右侧长内容滚走 */}
				<aside className="hidden md:block md:sticky md:top-24 md:self-start md:max-h-[calc(100vh-8rem)] md:overflow-y-auto shrink-0 pb-8">
					<DesignSystemSidebar currentPath={pathname} />
				</aside>

				{/* 各章节主内容区：原位交接，杜绝闪白 */}
				<div className="min-w-0 flex-1">
					<Outlet />
					<DesignSystemPagination currentId={activeItem.id} />
				</div>
			</div>
		</PageShell>
	);
}
