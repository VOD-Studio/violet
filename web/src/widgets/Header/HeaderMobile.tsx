import { NAV_ITEMS, resolveActiveNav } from "@shared/config/nav";
import { useRouterState } from "@tanstack/react-router";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@violet/ui";

import { Menu } from "lucide-react";
import { useState } from "react";

import HeaderNavRow from "./HeaderNavRow";

const SECTION_LABEL =
	"px-2 pb-1.5 font-mono text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase";

/**
 * HeaderMobile - 移动端抽屉导航
 *
 * 触发器对齐胶囊右侧圆形按钮；带二级的项在抽屉里缩进展开，纯分组以小标题分段。
 */
const HeaderMobile = () => {
	const [open, setOpen] = useState(false);
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const activeTo = resolveActiveNav(pathname)?.link.to;

	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<SheetTrigger asChild>
				<button
					type="button"
					aria-label="打开导航菜单"
					className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground lg:hidden"
				>
					<Menu className="size-4" />
				</button>
			</SheetTrigger>
			<SheetContent
				side="right"
				className="flex w-88 max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden p-0 border-l border-border/60 bg-background/95 backdrop-blur-xl"
			>
				<SheetHeader className="border-b border-border/40 bg-muted/20 px-5 py-4 text-left">
					<div className="flex items-center gap-2">
						<span
							aria-hidden="true"
							className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
						>
							<svg
								aria-hidden="true"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
								className="size-3"
							>
								<circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
								<path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
							</svg>
						</span>
						<span className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-foreground">
							Violet
						</span>
					</div>
					<SheetTitle className="text-base font-semibold text-foreground pt-1">
						浏览本站
					</SheetTitle>
					<SheetDescription className="text-xs text-muted-foreground">
						文章、系列、图集与社区空间
					</SheetDescription>
				</SheetHeader>

				<nav
					aria-label="移动端导航菜单"
					className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4"
				>
					<div className="flex flex-col gap-1">
						{NAV_ITEMS.filter((item) => item.to !== undefined).map((item) => {
							const to = item.to as string;
							// 与父项同一目标的二级项（如「博客 → 全部文章」）在抽屉里不重复列出
							const children = (item.children ?? []).filter(
								(child) => child.to !== to,
							);
							return (
								<div key={item.label} className="flex flex-col gap-1">
									<HeaderNavRow
										link={{ ...item, to }}
										current={activeTo === to}
										onClick={() => setOpen(false)}
									/>
									{children.length > 0 && (
										<div className="ml-6 flex flex-col gap-1 border-l border-border/60 pl-2">
											{children.map((child) => (
												<HeaderNavRow
													key={child.to}
													link={child}
													current={activeTo === child.to}
													onClick={() => setOpen(false)}
												/>
											))}
										</div>
									)}
								</div>
							);
						})}
					</div>

					{NAV_ITEMS.filter((item) => item.to === undefined && item.children).map(
						(group) => (
							<div key={group.label}>
								<p className={SECTION_LABEL}>{group.label}</p>
								<div className="flex flex-col gap-1">
									{group.children?.map((child) => (
										<HeaderNavRow
											key={child.to}
											link={child}
											current={activeTo === child.to}
											onClick={() => setOpen(false)}
										/>
									))}
								</div>
							</div>
						),
					)}
				</nav>
			</SheetContent>
		</Sheet>
	);
};

export default HeaderMobile;
