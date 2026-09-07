import type { NavRouteItem } from "@shared/config/nav";
import { NAV_ITEMS } from "@shared/config/nav";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@shared/ui/base/sheet";
import { Menu } from "lucide-react";
import { useState } from "react";

import HeaderNavItem from "./HeaderNavItem";

export interface HeaderMobileProps {
	onAction?: (action: string) => void;
}

/**
 * HeaderMobile - 移动端抽屉导航
 *
 * 触发器对齐胶囊右侧圆形按钮，抽屉内分为主导航与更多探索两列。
 * 严禁 scale 变形。
 */
const HeaderMobile = ({ onAction }: HeaderMobileProps) => {
	const [open, setOpen] = useState(false);

	const primaryItems = NAV_ITEMS.filter(
		(item): item is NavRouteItem => item.type === "route" && Boolean(item.primary),
	);
	const secondaryItems = NAV_ITEMS.filter((item) => item.type !== "route" || !item.primary);

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
					{/* 核心主导航 */}
					<div>
						<p className="px-2 pb-1.5 font-mono text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
							Navigation / 主导航
						</p>
						<div className="flex flex-col gap-1">
							{primaryItems.map((item) => (
								<HeaderNavItem
									key={item.label}
									item={item}
									detailed
									onNavigate={() => setOpen(false)}
									onAction={(action) => {
										onAction?.(action);
										setOpen(false);
									}}
								/>
							))}
						</div>
					</div>

					{/* 更多探索 */}
					{secondaryItems.length > 0 && (
						<div>
							<p className="px-2 pb-1.5 font-mono text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
								Explore / 更多探索
							</p>
							<div className="flex flex-col gap-1">
								{secondaryItems.map((item) => (
									<HeaderNavItem
										key={item.label}
										item={item}
										detailed
										onNavigate={() => setOpen(false)}
										onAction={(action) => {
											onAction?.(action);
											setOpen(false);
										}}
									/>
								))}
							</div>
						</div>
					)}
				</nav>
			</SheetContent>
		</Sheet>
	);
};

export default HeaderMobile;
