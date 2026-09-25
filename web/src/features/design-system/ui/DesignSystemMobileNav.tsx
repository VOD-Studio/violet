import { TreeNav, type TreeNavGroup } from "@shared/ui/tree-nav";
import { Link } from "@tanstack/react-router";
import { BookOpen, ChevronLeft, ChevronRight, ChevronUp, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import {
	DESIGN_SYSTEM_NAV_GROUPS,
	type DesignSystemNavItem,
	getSiblingNavItems,
} from "../model/navigation";

export interface DesignSystemMobileNavProps {
	/** 当前章节项 */
	activeItem: DesignSystemNavItem;
	/** 当前路由路径 */
	currentPath: string;
}

/**
 * 营造法式移动端专属悬浮导航：
 * 抽屉内复用 shared/ui/tree-nav 通用多级树形导航，
 * 支持最多 4 级目录深度与多级左侧竖线流体注入生长动效，严格零布局抖动。
 */
export function DesignSystemMobileNav({ activeItem, currentPath }: DesignSystemMobileNavProps) {
	const [drawerOpen, setDrawerOpen] = useState(false);
	const { prev, next } = getSiblingNavItems(activeItem.id);

	const treeNavGroups: TreeNavGroup[] = useMemo(
		() =>
			DESIGN_SYSTEM_NAV_GROUPS.map((group) => ({
				id: group.id,
				title: group.title,
				items: group.items.map((item) => ({
					id: item.id,
					title: item.title,
					to: item.to,
					badge: item.num,
					children: item.children?.map((sub) => ({
						id: sub.id,
						title: sub.title,
						to: sub.to,
					})),
				})),
			})),
		[],
	);

	return (
		<>
			{/* 移动端底部黄金触控区悬浮胶囊 */}
			<aside
				aria-label="移动端章节切换"
				className="fixed right-0 bottom-6 left-0 z-40 flex justify-center px-4 pointer-events-none md:hidden"
			>
				<div className="flex items-center gap-1 rounded-full border border-border/70 bg-background/90 p-1 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-xl pointer-events-auto">
					{/* 上一章快捷切换 */}
					{prev ? (
						<Link
							to={prev.to}
							title={`上一章：${prev.title}`}
							className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground active:scale-95"
						>
							<ChevronLeft className="h-4 w-4" />
							<span className="sr-only">上一章</span>
						</Link>
					) : (
						<div className="w-1" />
					)}

					{/* 核心触控区：章节名称 + 展开卷目抽屉 */}
					<button
						type="button"
						onClick={() => setDrawerOpen(true)}
						className="flex items-center gap-2 rounded-full bg-primary/10 px-3.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-primary/15 active:scale-98"
					>
						<BookOpen className="h-3.5 w-3.5 text-primary" />
						<span className="font-serif font-bold text-primary">
							章{activeItem.num}
						</span>
						<span className="max-w-30 truncate font-serif font-semibold">
							{activeItem.title}
						</span>
						<ChevronUp className="h-3.5 w-3.5 text-muted-foreground/80" />
					</button>

					{/* 下一章快捷切换 */}
					{next ? (
						<Link
							to={next.to}
							title={`下一章：${next.title}`}
							className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground active:scale-95"
						>
							<ChevronRight className="h-4 w-4" />
							<span className="sr-only">下一章</span>
						</Link>
					) : (
						<div className="w-1" />
					)}
				</div>
			</aside>

			{/* 移动端底部原生丝滑卷目抽屉 */}
			<AnimatePresence>
				{drawerOpen && (
					<div className="fixed inset-0 z-50 flex flex-col justify-end md:hidden">
						{/* 柔光半透明遮罩 */}
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.18 }}
							onClick={() => setDrawerOpen(false)}
							className="absolute inset-0 bg-background/80 backdrop-blur-xs"
						/>

						{/* 纯平滑轻量抽屉 */}
						<motion.div
							initial={{ y: "100%" }}
							animate={{ y: 0 }}
							exit={{ y: "100%" }}
							transition={{ duration: 0.22, ease: "easeOut" }}
							className="relative z-10 flex max-h-[82vh] flex-col rounded-t-3xl border-t border-border/60 bg-card/95 shadow-2xl backdrop-blur-2xl"
						>
							{/* 顶部抓手与标题栏 */}
							<div className="flex flex-col items-center border-b border-border/40 px-5 pt-3 pb-4">
								<div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
								<div className="mt-3 flex w-full items-center justify-between">
									<div className="flex items-baseline gap-2">
										<span className="font-serif text-base font-bold text-foreground">
											营造法式
										</span>
										<span className="font-serif text-xs text-muted-foreground/60">
											典籍卷目
										</span>
									</div>
									<button
										type="button"
										onClick={() => setDrawerOpen(false)}
										className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/60 text-muted-foreground transition-colors hover:text-foreground"
									>
										<X className="h-3.5 w-3.5" />
										<span className="sr-only">关闭卷目</span>
									</button>
								</div>
							</div>

							{/* 卷册内容可滚动区：复用 TreeNav */}
							<div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
								<TreeNav
									currentPath={currentPath}
									groups={treeNavGroups}
									onNavigate={() => setDrawerOpen(false)}
									fluidLayoutId="ds-mobile-fluid-indicator"
									ariaLabel="营造法式卷目"
								/>
							</div>
						</motion.div>
					</div>
				)}
			</AnimatePresence>
		</>
	);
}
