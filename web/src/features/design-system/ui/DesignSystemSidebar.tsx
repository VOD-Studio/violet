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

/**
 * 营造法式卷目索引导航：
 * 一级与二级菜单均拥有专属 LayoutId 物理弹簧滑动高亮指示器，
 * 二级菜单锚点点击支持丝滑平滑缓动滚动，告别生硬瞬间瞬移。
 */
export function DesignSystemSidebar({
	currentPath,
	onNavigate,
	className,
}: DesignSystemSidebarProps) {
	const [activeHash, setActiveHash] = useState(() =>
		typeof window !== "undefined" ? window.location.hash : "",
	);

	// 监听浏览器 hash 变化
	useEffect(() => {
		const handleHashChange = () => {
			setActiveHash(window.location.hash);
		};
		window.addEventListener("hashchange", handleHashChange);
		return () => window.removeEventListener("hashchange", handleHashChange);
	}, []);

	// 默认展开包含当前活跃路由或其子项的条目
	const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>(() => {
		const initial: Record<string, boolean> = {};
		for (const group of DESIGN_SYSTEM_NAV_GROUPS) {
			for (const item of group.items) {
				if (item.children && item.children.length > 0) {
					const hasActiveChild =
						currentPath.startsWith(item.to) ||
						item.children.some((child) => currentPath.startsWith(child.to));
					if (hasActiveChild) {
						initial[item.id] = true;
					}
				}
			}
		}
		return initial;
	});

	const toggleExpand = (itemId: string) => {
		setExpandedMap((prev) => ({
			...prev,
			[itemId]: !prev[itemId],
		}));
	};

	// 二级锚点平滑滚动处理
	const handleSubClick = (e: React.MouseEvent<HTMLAnchorElement>, to: string) => {
		onNavigate?.();
		const hashIndex = to.indexOf("#");
		if (hashIndex !== -1) {
			const hash = to.slice(hashIndex);
			const targetId = hash.slice(1);
			const target = document.getElementById(targetId);
			if (target) {
				e.preventDefault();
				target.scrollIntoView({ behavior: "smooth", block: "start" });
				window.history.pushState(null, "", to);
				setActiveHash(hash);
			}
		}
	};

	return (
		<nav
			aria-label="营造法式卷目"
			className={cn("w-56 shrink-0 py-2 text-sm select-none", className)}
		>
			{/* 卷首标题 */}
			<div className="mb-6 px-3">
				<div className="flex items-baseline gap-2">
					<span className="font-serif text-lg font-bold tracking-widest text-foreground">
						营造法式
					</span>
					<span className="font-serif text-[11px] text-muted-foreground/60">卷目</span>
				</div>
				<p className="mt-1 text-xs text-muted-foreground/70 leading-relaxed">
					站点的用色、用料与营造章程
				</p>
			</div>

			{/* 卷册目录列表 */}
			<div className="space-y-6">
				{DESIGN_SYSTEM_NAV_GROUPS.map((group) => (
					<div key={group.id} className="space-y-1.5">
						<div className="px-3 text-[11px] font-serif text-muted-foreground/60 tracking-wider">
							{group.title}
						</div>

						<ul className="space-y-0.5">
							{group.items.map((item) => {
								const hasChildren = Boolean(
									item.children && item.children.length > 0,
								);
								const isExpanded = Boolean(expandedMap[item.id]);
								const isCurrent =
									currentPath === item.to ||
									(currentPath.startsWith(item.to) &&
										currentPath[item.to.length] === "/");

								return (
									<li key={item.id} className="relative">
										{/* 一级菜单物理弹簧滑动高亮底块 */}
										{isCurrent && (
											<motion.div
												layoutId="ds-nav-active-indicator"
												className="absolute inset-0 rounded-lg bg-primary/10 border-l-2 border-primary pointer-events-none"
												transition={{
													type: "spring",
													stiffness: 420,
													damping: 34,
												}}
											/>
										)}

										<div className="relative group flex items-center justify-between rounded-lg">
											<Link
												to={item.to}
												onClick={onNavigate}
												aria-current={isCurrent ? "page" : undefined}
												className={cn(
													"flex flex-1 items-baseline gap-2.5 rounded-lg px-3 py-2 text-left z-10",
													isCurrent
														? "font-medium text-foreground"
														: "text-muted-foreground hover:text-foreground",
												)}
											>
												<span
													className={cn(
														"font-serif text-xs transition-colors duration-150",
														isCurrent
															? "text-primary font-bold"
															: "text-muted-foreground/60 group-hover:text-foreground/80",
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
													<motion.span
														animate={{ rotate: isExpanded ? 90 : 0 }}
														transition={{
															type: "spring",
															stiffness: 380,
															damping: 24,
														}}
														className="flex items-center justify-center"
													>
														<ChevronRight className="h-3.5 w-3.5" />
													</motion.span>
													<span className="sr-only">
														{isExpanded ? "收起" : "展开"}
														{item.title}子章节
													</span>
												</button>
											)}
										</div>

										{/* 丝滑物理弹簧展开容器 */}
										{hasChildren && (
											<AnimatePresence initial={false}>
												{isExpanded && (
													<motion.div
														initial={{ height: 0, opacity: 0 }}
														animate={{ height: "auto", opacity: 1 }}
														exit={{ height: 0, opacity: 0 }}
														transition={{
															height: {
																type: "spring",
																stiffness: 340,
																damping: 28,
																mass: 0.8,
															},
															opacity: { duration: 0.18 },
														}}
														className="overflow-hidden"
													>
														<ul className="mt-1 ml-5 border-l border-border/50 pl-2.5 space-y-0.5 pb-0.5">
															{item.children?.map((sub) => {
																const isSubCurrent =
																	(activeHash &&
																		sub.to.endsWith(
																			activeHash,
																		)) ||
																	(!activeHash &&
																		currentPath === sub.to);

																return (
																	<li
																		key={sub.id}
																		className="relative"
																	>
																		{/* 二级菜单专属物理滑动指示器 */}
																		{isSubCurrent && (
																			<motion.span
																				layoutId="ds-nav-sub-indicator"
																				className="absolute inset-0 rounded-md bg-primary/10 border-l-2 border-primary pointer-events-none"
																				transition={{
																					type: "spring",
																					stiffness: 450,
																					damping: 35,
																				}}
																			/>
																		)}

																		<a
																			href={sub.to}
																			onClick={(e) =>
																				handleSubClick(
																					e,
																					sub.to,
																				)
																			}
																			className={cn(
																				"relative z-10 block rounded-md px-2 py-1.5 text-xs transition-colors duration-150",
																				isSubCurrent
																					? "font-medium text-foreground"
																					: "text-muted-foreground/80 hover:text-foreground",
																			)}
																		>
																			<span className="truncate">
																				{sub.title}
																			</span>
																		</a>
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
