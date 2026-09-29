import { Outlet, useRouterState } from "@tanstack/react-router";
import { PageShell } from "@violet/ui";
import { findNavItemByPath } from "../model/navigation";
import { useNaturalAnchorTop } from "../model/use-natural-anchor-top";
import { DesignSystemMobileNav } from "./DesignSystemMobileNav";
import { DesignSystemPagination } from "./DesignSystemPagination";
import { DesignSystemSidebar } from "./DesignSystemSidebar";
/**
 * 桌面目录从首屏位置起保持吸附，移动端使用浮动导航。
 */
export function DesignSystemLayout() {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const activeItem = findNavItemByPath(pathname);
	const anchor = useNaturalAnchorTop<HTMLDivElement>();

	return (
		<PageShell className="font-serif pt-4 sm:pt-8">
			<DesignSystemMobileNav activeItem={activeItem} currentPath={pathname} />

			<div className="flex flex-col md:flex-row md:gap-10 lg:gap-14">
				{/* 吸附位由运行时测量自然顶位推导，头部或边距变化自动跟随 */}
				<aside
					className="scrollbar-hover-reveal hidden md:block md:sticky md:self-start md:overflow-y-auto shrink-0 pb-8"
					style={
						anchor.top === null
							? undefined
							: {
									top: anchor.top,
									maxHeight: `calc(100dvh - ${anchor.top}px - 2rem)`,
								}
					}
				>
					<DesignSystemSidebar currentPath={pathname} />
				</aside>

				<div className="min-w-0 flex-1" ref={anchor.ref}>
					<Outlet />
					<DesignSystemPagination currentId={activeItem.id} />
				</div>
			</div>
		</PageShell>
	);
}
