import { cn } from "@shared/lib/utils";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { DESIGN_SYSTEM_NAV_GROUPS } from "../model/navigation";

export interface DesignSystemSidebarProps {
	/** 当前路由路径 */
	currentPath: string;
	/** 导航点击后的回调 */
	onNavigate?: () => void;
	/** 自定义类名 */
	className?: string;
}

/** 统一的非弹簧流体缓动配置：纯净流体滑动，快速到位，绝无弹簧回弹与晃动 */
const FLUID_TRANSITION = {
	type: "tween" as const,
	ease: [0.22, 1, 0.36, 1] as const,
	duration: 0.22,
};

/**
 * 营造法式卷目索引导航：
 * 采用全树共享 LayoutId 纯平滑流体指示器，
 * 一级与多级项之间丝滑流体滑移变形，非弹簧，零回弹，零闪烁。
 */
export function DesignSystemSidebar({
	currentPath,
	onNavigate,
	className,
}: DesignSystemSidebarProps) {
	// 默认展开包含当前活跃路由或其子项的条目
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

	// 路径变化时，确保目标父章节展开
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

	// 计算全局唯一的活跃项 Key
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

	return (
		<nav
			aria-label="营造法式卷目"
			className={cn(
				"w-60 shrink-0 border-r border-border/50 py-2 pr-6 select-none",
				className,
			)}
		>
			{/* 卷首标题 */}
			<div className="mb-7 px-2">
				<div className="flex items-baseline gap-2">
					<span className="font-serif text-lg font-bold tracking-widest text-foreground">
						营造法式
					</span>
					<span className="font-serif text-xs font-medium text-primary/80">卷目</span>
				</div>
				<p className="mt-1 text-xs text-muted-foreground leading-relaxed">
					站点的用色、用料与营造章程
				</p>
			</div>

			{/* 卷册目录列表 */}
			<div className="space-y-6">
				{DESIGN_SYSTEM_NAV_GROUPS.map((group) => (
					<div key={group.id} className="space-y-2">
						<div className="px-2 text-xs font-serif font-bold text-foreground/80 tracking-wider">
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
									Boolean(item.children?.some((sub) => currentPath === sub.to));

								return (
									<li key={item.id} className="space-y-1">
										{/* 一级菜单行：高度恒定、独立高亮 */}
										<div className="relative flex items-center justify-between rounded-lg">
											{/* 全树共享流体滑块：纯 Tween 缓动，非弹簧，滑移至当前一级项 */}
											{isThisItemActive && (
												<motion.div
													layoutId="ds-fluid-indicator"
													className="absolute inset-0 rounded-lg bg-primary/10 pointer-events-none"
													transition={FLUID_TRANSITION}
												/>
											)}

											<Link
												to={item.to}
												onClick={onNavigate}
												aria-current={isThisItemActive ? "page" : undefined}
												className={cn(
													"relative z-10 flex flex-1 items-baseline gap-2.5 rounded-lg px-2.5 py-2 text-left font-medium transition-colors duration-150",
													isThisItemActive
														? "text-primary font-bold"
														: isBranchActive
															? "text-foreground font-semibold"
															: "text-muted-foreground hover:text-foreground",
												)}
											>
												<span
													className={cn(
														"font-serif text-xs transition-colors duration-150",
														isBranchActive
															? "text-primary font-bold"
															: "text-muted-foreground/70",
													)}
												>
													{item.num}
												</span>
												<span className="tracking-wide text-xs sm:text-[13px]">
													{item.title}
												</span>
											</Link>

											{hasChildren && (
												<button
													type="button"
													onClick={() => toggleExpand(item.id)}
													title={isExpanded ? "收起子章节" : "展开子章节"}
													className="relative z-10 mr-1 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/60 hover:text-foreground transition-colors"
												>
													<ChevronRight
														className={cn(
															"h-3.5 w-3.5 transition-transform duration-200 ease-out",
															isExpanded && "rotate-90",
														)}
													/>
													<span className="sr-only">
														{isExpanded ? "收起" : "展开"}
														{item.title}子章节
													</span>
												</button>
											)}
										</div>

										{/* 二级菜单列表 */}
										{hasChildren && (
											<AnimatePresence initial={false}>
												{isExpanded && (
													<motion.div
														initial={{ height: 0, opacity: 0 }}
														animate={{ height: "auto", opacity: 1 }}
														exit={{ height: 0, opacity: 0 }}
														transition={{
															height: FLUID_TRANSITION,
															opacity: { duration: 0.16 },
														}}
														className="overflow-hidden"
													>
														<ul className="mt-1 ml-4 border-l border-border/60 pl-3 space-y-1 pb-1">
															{item.children?.map((sub) => {
																const isThisSubActive =
																	activeKey === sub.to;

																return (
																	<li
																		key={sub.id}
																		className="relative"
																	>
																		{/* 全树共享流体滑块：从一级平滑流体滑动至二级，非弹簧 */}
																		{isThisSubActive && (
																			<motion.div
																				layoutId="ds-fluid-indicator"
																				className="absolute inset-0 rounded-md bg-primary/10 pointer-events-none"
																				transition={
																					FLUID_TRANSITION
																				}
																			/>
																		)}

																		<Link
																			to={sub.to}
																			onClick={onNavigate}
																			aria-current={
																				isThisSubActive
																					? "page"
																					: undefined
																			}
																			className={cn(
																				"relative z-10 block rounded-md px-2 py-1.5 text-xs transition-colors duration-150 font-normal",
																				isThisSubActive
																					? "font-medium text-primary"
																					: "text-muted-foreground hover:text-foreground",
																			)}
																		>
																			<span className="truncate">
																				{sub.title}
																			</span>
																		</Link>
																	</li>
																);
															})}
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
		</nav>
	);
}
