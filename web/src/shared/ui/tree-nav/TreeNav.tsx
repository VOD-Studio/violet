import { cn } from "@shared/lib/utils";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import {
	MAX_TREE_NAV_DEPTH,
	type TreeNavGroup,
	type TreeNavItem,
	type TreeNavProps,
} from "./types";

/**
 * 统一的非弹簧流体缓动配置：纯净流体滑动，快速到位，绝无弹簧回弹与晃动。
 */
const FLUID_TRANSITION = {
	type: "tween" as const,
	ease: [0.22, 1, 0.36, 1] as const,
	duration: 0.22,
};

/**
 * 判断指定节点或其后代是否处于活跃状态。
 */
export function isNodeOrDescendantActive(
	item: TreeNavItem,
	currentPath: string,
	depth = 1,
): boolean {
	if (
		item.to &&
		(currentPath === item.to ||
			(currentPath.startsWith(item.to) && currentPath[item.to.length] === "/"))
	) {
		return true;
	}
	if (depth >= MAX_TREE_NAV_DEPTH || !item.children?.length) {
		return false;
	}
	return item.children.some((child) => isNodeOrDescendantActive(child, currentPath, depth + 1));
}

/**
 * 递归收集所有包含活跃子孙的节点 ID，用于默认展开目标分支。
 */
function collectActiveBranchIds(
	items: TreeNavItem[],
	currentPath: string,
	depth = 1,
	acc: Record<string, boolean> = {},
): Record<string, boolean> {
	if (depth >= MAX_TREE_NAV_DEPTH) return acc;
	for (const item of items) {
		if (item.children?.length) {
			const hasActiveChild = item.children.some((child) =>
				isNodeOrDescendantActive(child, currentPath, depth + 1),
			);
			if (hasActiveChild || (item.to && currentPath.startsWith(item.to))) {
				acc[item.id] = true;
			}
			collectActiveBranchIds(item.children, currentPath, depth + 1, acc);
		}
	}
	return acc;
}

/**
 * 计算全局唯一的活跃项 Key（优先精确匹配叶子，其次匹配前缀）。
 */
function findActiveKey(items: TreeNavItem[], currentPath: string, depth = 1): string | null {
	if (depth > MAX_TREE_NAV_DEPTH) return null;
	// 优先在后代中精确查找
	for (const item of items) {
		if (item.children?.length && depth < MAX_TREE_NAV_DEPTH) {
			const childMatch = findActiveKey(item.children, currentPath, depth + 1);
			if (childMatch) return childMatch;
		}
		if (item.to && currentPath === item.to) {
			return item.to;
		}
	}
	// 其次前缀匹配
	for (const item of items) {
		if (
			item.to &&
			currentPath.startsWith(item.to) &&
			(currentPath[item.to.length] === "/" || currentPath.length === item.to.length)
		) {
			return item.to;
		}
	}
	return null;
}

interface TreeNavItemNodeProps {
	item: TreeNavItem;
	depth: number;
	currentPath: string;
	activeKey: string | null;
	expandedMap: Record<string, boolean>;
	toggleExpand: (id: string) => void;
	onNavigate?: () => void;
	fluidLayoutId: string;
}

/**
 * 递归渲染的单项树节点（支持最多 4 级）。
 */
function TreeNavItemNode({
	item,
	depth,
	currentPath,
	activeKey,
	expandedMap,
	toggleExpand,
	onNavigate,
	fluidLayoutId,
}: TreeNavItemNodeProps) {
	if (depth > MAX_TREE_NAV_DEPTH) return null;

	const hasChildren = Boolean(
		depth < MAX_TREE_NAV_DEPTH && item.children && item.children.length > 0,
	);
	const isExpanded = Boolean(expandedMap[item.id]);

	const isThisItemActive = Boolean(item.to && activeKey === item.to);
	const isBranchActive = isNodeOrDescendantActive(item, currentPath, depth);

	// 根据深度层级微调文字排版规范
	const depthTextClass =
		depth === 1
			? "text-xs sm:text-[13px]"
			: depth === 2
				? "text-xs"
				: depth === 3
					? "text-xs opacity-90"
					: "text-[11px] opacity-80";

	// 统一恒定字重，避免字重突变导致文字变宽引发水平抖动
	const linkColorClass = isThisItemActive
		? "text-primary font-semibold"
		: isBranchActive
			? "text-foreground font-medium"
			: "text-muted-foreground hover:text-foreground font-normal";

	const content = (
		<>
			{item.badge && (
				<span
					className={cn(
						"font-serif text-xs transition-colors duration-150 shrink-0",
						isBranchActive ? "text-primary font-medium" : "text-muted-foreground/70",
					)}
				>
					{item.badge}
				</span>
			)}
			<span className={cn("truncate tracking-wide", depthTextClass)}>{item.title}</span>
		</>
	);

	return (
		<li className="space-y-1">
			<div className="relative flex items-center justify-between rounded-lg">
				{/* 全树共享流体滑块：在各级间平滑滑动 */}
				{isThisItemActive && (
					<motion.div
						layoutId={fluidLayoutId}
						className="absolute inset-0 rounded-lg bg-primary/10 pointer-events-none"
						transition={FLUID_TRANSITION}
					/>
				)}

				{item.to ? (
					<Link
						to={item.to}
						onClick={onNavigate}
						aria-current={isThisItemActive ? "page" : undefined}
						className={cn(
							"relative z-10 flex flex-1 items-baseline gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors duration-150",
							linkColorClass,
						)}
					>
						{content}
					</Link>
				) : (
					<button
						type="button"
						onClick={() => hasChildren && toggleExpand(item.id)}
						className={cn(
							"relative z-10 flex flex-1 items-baseline gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors duration-150 cursor-pointer",
							linkColorClass,
						)}
					>
						{content}
					</button>
				)}

				{hasChildren && (
					<button
						type="button"
						onClick={() => toggleExpand(item.id)}
						title={isExpanded ? "收起子章节" : "展开子章节"}
						className={cn(
							"relative z-10 mr-1 flex h-6 w-6 items-center justify-center rounded-md transition-colors",
							isBranchActive
								? "text-primary/70 hover:text-primary"
								: "text-muted-foreground/60 hover:text-foreground",
						)}
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

			{/* 多级展开区域：递归渲染下一层级 */}
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
							<div className="relative mt-1 ml-4 pl-3 pb-1">
								{/* 静态未激活底轨：恒定发丝线，位置固定绝不造成抖动 */}
								<div
									aria-hidden="true"
									className="absolute left-0 top-1 bottom-1 w-px bg-border/50"
								/>

								{/* 代表本组被选中的高亮竖线：自上而下墨线注入流体生长动画 */}
								<AnimatePresence>
									{isBranchActive && (
										<motion.div
											key={`active-line-d${depth}-${item.id}`}
											aria-hidden="true"
											initial={{ scaleY: 0, opacity: 0 }}
											animate={{ scaleY: 1, opacity: 1 }}
											exit={{ scaleY: 0, opacity: 0 }}
											transition={{
												scaleY: {
													type: "tween",
													ease: [0.22, 1, 0.36, 1],
													duration: 0.28,
												},
												opacity: { duration: 0.18 },
											}}
											className="absolute left-0 top-1 bottom-1 w-0.5 -translate-x-1/2 origin-top rounded-full bg-primary pointer-events-none"
										/>
									)}
								</AnimatePresence>

								<ul className="space-y-1">
									{item.children?.map((sub) => (
										<TreeNavItemNode
											key={sub.id}
											item={sub}
											depth={depth + 1}
											currentPath={currentPath}
											activeKey={activeKey}
											expandedMap={expandedMap}
											toggleExpand={toggleExpand}
											onNavigate={onNavigate}
											fluidLayoutId={fluidLayoutId}
										/>
									))}
								</ul>
							</div>
						</motion.div>
					)}
				</AnimatePresence>
			)}
		</li>
	);
}

/**
 * 通用多级树形导航组件（支持最多 4 级）。
 *
 * 核心特性：
 * 1. 深度限制在最多 4 级，每级具备自适应字体与规范缩进；
 * 2. 多级左侧竖线代表组被选中：未激活时为发丝底轨，激活时带有由上至下的流体注入生长动画；
 * 3. 严格零布局抖动（绝对定位轨道，文字恒定字重，避免字符加粗膨胀带来的水平抖动）。
 */
export function TreeNav({
	currentPath,
	groups,
	items,
	onNavigate,
	className,
	fluidLayoutId = "tree-nav-fluid-indicator",
	defaultExpandAll = false,
	ariaLabel = "目录导航",
}: TreeNavProps) {
	// 标准化分组格式
	const normalizedGroups: TreeNavGroup[] =
		groups ?? (items ? [{ id: "root", title: "", items }] : []);

	// 初始默认展开活跃分支或全部
	const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>(() => {
		const initial: Record<string, boolean> = {};
		for (const group of normalizedGroups) {
			if (defaultExpandAll) {
				const expandRecursive = (list: TreeNavItem[], depth = 1) => {
					if (depth >= MAX_TREE_NAV_DEPTH) return;
					for (const it of list) {
						if (it.children?.length) {
							initial[it.id] = true;
							expandRecursive(it.children, depth + 1);
						}
					}
				};
				expandRecursive(group.items);
			} else {
				collectActiveBranchIds(group.items, currentPath, 1, initial);
			}
		}
		return initial;
	});

	// 路由路径变化时，确保目标父章节展开
	useEffect(() => {
		if (defaultExpandAll) return;
		for (const group of normalizedGroups) {
			const activeIds = collectActiveBranchIds(group.items, currentPath, 1);
			setExpandedMap((prev) => {
				let changed = false;
				const next = { ...prev };
				for (const id of Object.keys(activeIds)) {
					if (!next[id]) {
						next[id] = true;
						changed = true;
					}
				}
				return changed ? next : prev;
			});
		}
	}, [currentPath, defaultExpandAll, normalizedGroups]);

	const toggleExpand = (itemId: string) => {
		setExpandedMap((prev) => ({
			...prev,
			[itemId]: !prev[itemId],
		}));
	};

	// 查找全局活跃条目
	const allItems = normalizedGroups.flatMap((g) => g.items);
	const activeKey = findActiveKey(allItems, currentPath, 1);

	return (
		<nav aria-label={ariaLabel} className={cn("select-none", className)}>
			<div className="space-y-6">
				{normalizedGroups.map((group) => {
					const isGroupActive = group.items.some((item) =>
						isNodeOrDescendantActive(item, currentPath, 1),
					);

					return (
						<div key={group.id} className="space-y-2">
							{group.title && (
								<div
									className={cn(
										"px-2 text-xs font-serif font-bold tracking-wider transition-colors duration-150",
										isGroupActive
											? "text-foreground"
											: "text-muted-foreground/70",
									)}
								>
									{group.title}
								</div>
							)}

							<ul className="space-y-1">
								{group.items.map((item) => (
									<TreeNavItemNode
										key={item.id}
										item={item}
										depth={1}
										currentPath={currentPath}
										activeKey={activeKey}
										expandedMap={expandedMap}
										toggleExpand={toggleExpand}
										onNavigate={onNavigate}
										fluidLayoutId={fluidLayoutId}
									/>
								))}
							</ul>
						</div>
					);
				})}
			</div>
		</nav>
	);
}
