import { Outlet, useRouterState } from "@tanstack/react-router";
import { PageShell } from "@violet/ui";
import { findNavItemByPath } from "../model/navigation";
import { useNaturalAnchorTop } from "../model/use-natural-anchor-top";
import { UiDocsMobileNav } from "./UiDocsMobileNav";
import { UiDocsPagination } from "./UiDocsPagination";
import { UiDocsSidebar } from "./UiDocsSidebar";

export function UiDocsLayout() {
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const activeItem = findNavItemByPath(pathname);
	const anchor = useNaturalAnchorTop<HTMLDivElement>();

	return (
		<PageShell className="pt-4 font-sans sm:pt-8">
			<UiDocsMobileNav activeItem={activeItem} currentPath={pathname} />
			<div className="flex flex-col md:flex-row md:gap-10 lg:gap-14">
				<aside
					className="scrollbar-hover-reveal hidden w-60 shrink-0 border-r border-border pr-6 pb-8 md:sticky md:block md:self-start md:overflow-y-auto"
					style={
						anchor.top === null
							? undefined
							: {
									top: anchor.top,
									maxHeight: `calc(100dvh - ${anchor.top}px - 2rem)`,
								}
					}
				>
					<UiDocsSidebar currentPath={pathname} />
				</aside>
				<div ref={anchor.ref} className="min-w-0 flex-1">
					<Outlet />
					<UiDocsPagination currentId={activeItem.id} />
				</div>
			</div>
		</PageShell>
	);
}
