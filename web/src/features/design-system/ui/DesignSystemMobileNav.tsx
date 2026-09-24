import { cn } from "@shared/lib/utils";
import { Link } from "@tanstack/react-router";
import { BookOpen, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
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

const FLUID_TRANSITION = {
	type: "tween" as const,
	ease: [0.22, 1, 0.36, 1] as const,
	duration: 0.22,
};

/**
 * 营造法式移动端专属悬浮导航：
 * 抽屉内全树共享非弹簧纯平滑流体指示器，
 * 一级与二级无缝流体滑移，零回弹，零闪烁。
 */
export function DesignSystemMobileNav({ activeItem, currentPath }: DesignSystemMobileNavProps) {
	const [drawerOpen, setDrawerOpen] = useState(false);
	const { prev, next } = getSiblingNavItems(activeItem.id);

	const activeKey = (() => {
		for (const group of DESIGN_SYSTEM_NAV_GROUPS) {
			for (const item of group.items) {
				if (item.children) {
					const matchedSub = item.children.find((sub) => currentPath === sub.to);
					if (matchedSub) return matchedSub.to;
				}
			}
		}
		for (const group of DESIGN_SYSTEM_NAV_GROUPS) {
			for (const item of group.items) {
				if (
					currentPath === item.to ||
					(currentPath.startsWith(item.to) && currentPath[item.to.length] === "/")
				) {
					return item.to;
				}
			}
		}
		return currentPath;
	})();

	// 二级菜单展开状态管理
	const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>(() => {
		const initial: Record<string, boolean> = {};
		for (const group of DESIGN_SYSTEM_NAV_GROUPS) {
			for (const item of group.items) {
				if (item.children && item.children.length > 0) {
					if (
						currentPath.startsWith(item.to) ||
						item.children.some((child) => currentPath === child.to)
					) {
						initial[item.id] = true;
					}
				}
			}
		}
		return initial;
	});

	// 路径变化时展开对应父章节
	useEffect(() => {
		for (const group of DESIGN_SYSTEM_NAV_GROUPS) {
			for (const item of group.items) {
				if (item.children && item.children.length > 0) {
					if (
						currentPath.startsWith(item.to) ||
						item.children.some((child) => currentPath === child.to)
					) {
						setExpandedMap((prev) =>
							prev[item.id] ? prev : { ...prev, [item.id]: true },
						);
					}
				}
			}
		}
	}, [currentPath]);

	const toggleExpand = (itemId: string) => {
		setExpandedMap((prev) => ({
			...prev,
			[itemId]: !prev[itemId],
		}));
	};

	return (
		<>
			{/* 移动端底部黄金触控区悬浮胶囊 */}
			<aside
				aria-label="移动端章节切换"
				className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 md:hidden"
			>
				<div className="flex items-center gap-1 rounded-full border border-border/70 bg-background/90 p-1 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-xl">
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
						<span className="max-w-[120px] truncate font-serif font-semibold">
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

							{/* 卷册内容可滚动区 */}
							<div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 space-y-6">
								{DESIGN_SYSTEM_NAV_GROUPS.map((group) => (
									<div key={group.id} className="space-y-1.5">
										<div className="px-2 text-xs font-serif font-medium text-muted-foreground/70">
											{group.title}
										</div>

										<ul className="space-y-1">
											{group.items.map((item) => {
												const hasChildren = Boolean(
													item.children && item.children.length > 0,
												);
												const isExpanded = Boolean(expandedMap[item.id]);
												const isThisItemActive = activeKey === item.to;
												const isBranchActive =
													currentPath.startsWith(item.to) ||
													Boolean(
														item.children?.some(
															(sub) => currentPath === sub.to,
														),
													);

												return (
													<li key={item.id} className="space-y-0.5">
														<div className="relative flex items-center justify-between rounded-xl">
															{isThisItemActive && (
																<motion.div
																	layoutId="ds-mobile-fluid-indicator"
																	className="absolute inset-0 rounded-xl bg-primary/10 pointer-events-none"
																	transition={FLUID_TRANSITION}
																/>
															)}

															<Link
																to={item.to}
																onClick={() => setDrawerOpen(false)}
																className={cn(
																	"relative z-10 flex flex-1 items-baseline gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors duration-150",
																	isThisItemActive
																		? "font-bold text-primary"
																		: isBranchActive
																			? "text-foreground font-semibold"
																			: "text-muted-foreground hover:text-foreground",
																)}
															>
																<span
																	className={cn(
																		"font-serif text-xs",
																		isBranchActive
																			? "text-primary font-bold"
																			: "text-muted-foreground/60",
																	)}
																>
																	{item.num}
																</span>
																<span className="truncate">
																	{item.title}
																</span>
															</Link>

															{hasChildren && (
																<button
																	type="button"
																	onClick={() =>
																		toggleExpand(item.id)
																	}
																	className="relative z-10 p-2.5 text-muted-foreground/60 hover:text-foreground"
																>
																	<ChevronDown
																		className={cn(
																			"h-4 w-4 transition-transform duration-200 ease-out",
																			isExpanded &&
																				"rotate-180",
																		)}
																	/>
																	<span className="sr-only">
																		{isExpanded
																			? "收起"
																			: "展开"}
																		子菜单
																	</span>
																</button>
															)}
														</div>

														{/* 二级菜单展开项：纯平滑 Tween，无弹簧 */}
														{hasChildren && (
															<AnimatePresence initial={false}>
																{isExpanded && (
																	<motion.div
																		initial={{
																			height: 0,
																			opacity: 0,
																		}}
																		animate={{
																			height: "auto",
																			opacity: 1,
																		}}
																		exit={{
																			height: 0,
																			opacity: 0,
																		}}
																		transition={{
																			height: FLUID_TRANSITION,
																			opacity: {
																				duration: 0.16,
																			},
																		}}
																		className="overflow-hidden"
																	>
																		<ul className="ml-5 border-l border-border/40 pl-3 py-1 space-y-1">
																			{item.children?.map(
																				(sub) => {
																					const isThisSubActive =
																						activeKey ===
																						sub.to;

																					return (
																						<li
																							key={
																								sub.id
																							}
																							className="relative"
																						>
																							{isThisSubActive && (
																								<motion.div
																									layoutId="ds-mobile-fluid-indicator"
																									className="absolute inset-0 rounded-lg bg-primary/10 pointer-events-none"
																									transition={
																										FLUID_TRANSITION
																									}
																								/>
																							)}

																							<Link
																								to={
																									sub.to
																								}
																								onClick={() =>
																									setDrawerOpen(
																										false,
																									)
																								}
																								aria-current={
																									isThisSubActive
																										? "page"
																										: undefined
																								}
																								className={cn(
																									"relative z-10 block rounded-lg px-2.5 py-2 text-xs transition-colors duration-150",
																									isThisSubActive
																										? "font-medium text-primary"
																										: "text-muted-foreground hover:text-foreground",
																								)}
																							>
																								{
																									sub.title
																								}
																							</Link>
																						</li>
																					);
																				},
																			)}
																		</ul>
																	</motion.div>
																)}
															</AnimatePresence>
														)}
													</li>
												);
											})}
										</ul>
									</div>
								))}
							</div>
						</motion.div>
					</div>
				)}
			</AnimatePresence>
		</>
	);
}
