import { PageShell } from "@shared/ui/page-shell";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { findNavItemByPath } from "../model/navigation";
import { DesignSystemMobileNav } from "./DesignSystemMobileNav";
import { DesignSystemPagination } from "./DesignSystemPagination";
import { DesignSystemSidebar } from "./DesignSystemSidebar";

/**
 * 桌面目录从首屏位置起保持吸附，移动端使用浮动导航。
 */
export function DesignSystemLayout() {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const activeItem = findNavItemByPath(pathname);

	return (
		<PageShell className="font-serif pt-4 sm:pt-8">
			<DesignSystemMobileNav activeItem={activeItem} currentPath={pathname} />

			<div className="flex flex-col md:flex-row md:gap-10 lg:gap-14">
				{/* Header 高 54px，页面上边距 48px；吸附位置必须与目录初始位置一致。 */}
				<aside className="hidden md:block md:sticky md:top-[102px] md:self-start md:max-h-[calc(100vh-8rem)] md:overflow-y-auto shrink-0 pb-8">
					<DesignSystemSidebar currentPath={pathname} />
				</aside>

				<div className="min-w-0 flex-1">
					<Outlet />
					<DesignSystemPagination currentId={activeItem.id} />
				</div>
			</div>
		</PageShell>
	);
}
