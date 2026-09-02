import { SegmentedArticleToc } from "@entities/post/ui/SegmentedArticleToc";
import { cn } from "@shared/lib/utils";
import { ChevronRight } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { RefObject } from "react";
import { useEffect, useMemo, useState } from "react";
import { ARTICLE, type ArticleSection, type TocNode, type TocVariant } from "../model/article";

export interface TocVariantProps {
	nodes: TocNode[];
	activeId: string;
	collapsedIds: Set<string>;
	onNavigate: (id: string) => void;
	onToggle: (id: string) => void;
	compact?: boolean;
	/** 激活项挂载点：由页面层实现激活项滚入目录自身视口 */
	activeItemRef?: RefObject<HTMLLIElement | null>;
}
interface FlatItem {
	node: TocNode;
	depth: number;
	indexStr: string;
	parentId?: string;
	sectionData?: ArticleSection;
}

const springTransition = { type: "spring" as const, stiffness: 380, damping: 30 };
const instantTransition = { duration: 0 };

/** 递归拍平树形结构并计算层级序号 */
function flattenTree(
	nodes: TocNode[],
	sections: ArticleSection[],
	depth = 0,
	parentPrefix = "",
	parentId?: string,
): FlatItem[] {
	return nodes.flatMap((node, idx) => {
		const num = String(idx + 1).padStart(2, "0");
		const indexStr = depth === 0 ? num : `${parentPrefix}.${idx + 1}`;
		const sectionData = sections.find((s) => s.id === node.id);

		const current: FlatItem = {
			node,
			depth,
			indexStr,
			parentId,
			sectionData,
		};

		const childItems = flattenTree(
			node.children ?? [],
			sectionData?.children ?? [],
			depth + 1,
			indexStr,
			node.id,
		);

		return [current, ...childItems];
	});
}

/** 查找从根到目标节点的祖先链 */
function getActiveAncestorIds(
	nodes: TocNode[],
	targetId: string,
	currentChain: string[] = [],
): string[] {
	for (const node of nodes) {
		const nextChain = [...currentChain, node.id];
		if (node.id === targetId) return nextChain;
		if (node.children) {
			const found = getActiveAncestorIds(node.children, targetId, nextChain);
			if (found.length > 0) return found;
		}
	}
	return [];
}

/** 收起态悬浮快速预览气泡 (Hover Popover Card) */
function RailHoverTooltip({ item }: { item: FlatItem }) {
	const reduced = useReducedMotion();

	return (
		<motion.div
			initial={reduced ? { opacity: 0 } : { opacity: 0, x: -8, scale: 0.96 }}
			animate={{ opacity: 1, x: 0, scale: 1 }}
			exit={reduced ? { opacity: 0 } : { opacity: 0, x: -6, scale: 0.96 }}
			transition={
				reduced ? instantTransition : { type: "spring", stiffness: 420, damping: 28 }
			}
			className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 w-68 -translate-y-1/2 rounded-xl border border-edge-hairline bg-popover/95 p-3.5 text-popover-foreground shadow-2xl backdrop-blur-md"
		>
			<div className="mb-1.5 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
				<span className="font-semibold text-foreground">
					{item.depth === 0 ? `§ ${item.indexStr}` : item.indexStr}
				</span>
				<span className="rounded-sm bg-muted/60 px-1 py-0.5 text-[9px] uppercase">
					Level {item.depth + 1}
				</span>
			</div>
			<p className="text-[13.5px] font-semibold tracking-tight text-foreground">
				{item.node.title}
			</p>
			{item.sectionData?.lead && (
				<p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-muted-foreground">
					{item.sectionData.lead}
				</p>
			)}
		</motion.div>
	);
}

/* =========================================================================
 * 方案 1: Liquid Rail (流体轨道 - 1:1 原位几何对齐)
 * ========================================================================= */
function LiquidRail({
	nodes,
	activeId,
	onNavigate,
	compact = false,
	activeItemRef,
}: TocVariantProps) {
	const reduced = useReducedMotion();
	const flatItems = useMemo(() => flattenTree(nodes, ARTICLE), [nodes]);
	const [hoveredId, setHoveredId] = useState<string | null>(null);

	if (compact) {
		return (
			<nav aria-label="流体轨道收起刻度" className="relative flex flex-col py-1">
				<div className="pointer-events-none absolute bottom-4 left-1/2 top-4 w-px -translate-x-1/2 bg-border/40" />

				<ul className="space-y-1">
					{flatItems.map((item) => {
						const isActive = item.node.id === activeId;
						const isHovered = item.node.id === hoveredId;

						return (
							<li
								key={item.node.id}
								className="relative flex h-9 items-center justify-center"
								onMouseEnter={() => setHoveredId(item.node.id)}
								onMouseLeave={() => setHoveredId(null)}
							>
								{isActive && (
									<motion.span
										layoutId="liquid-compact-pill"
										transition={reduced ? instantTransition : springTransition}
										className="absolute inset-y-0.5 inset-x-0.5 rounded-md border border-foreground/[0.08] bg-foreground/[0.06] dark:bg-foreground/[0.1]"
									/>
								)}

								<button
									type="button"
									onClick={() => onNavigate(item.node.id)}
									aria-label={`跳转至 ${item.node.title}`}
									className="group relative z-10 flex size-full cursor-pointer items-center justify-center focus-visible:outline-none"
								>
									<span
										className={cn(
											"block rounded-full transition-all duration-200",
											item.depth === 0 && "h-1.5",
											item.depth === 1 && "h-1",
											item.depth === 2 && "h-0.5",
											item.depth === 0
												? isActive
													? "w-8"
													: "w-6"
												: item.depth === 1
													? isActive
														? "w-5"
														: "w-3.5"
													: isActive
														? "w-3"
														: "w-2",
											isActive
												? "bg-foreground shadow-xs"
												: isHovered
													? "scale-x-125 bg-foreground"
													: "bg-muted-foreground/40 group-hover:bg-muted-foreground/80",
										)}
									/>
								</button>

								<AnimatePresence>
									{isHovered && <RailHoverTooltip item={item} />}
								</AnimatePresence>
							</li>
						);
					})}
				</ul>
			</nav>
		);
	}

	return (
		<nav aria-label="流体轨道文章目录" className="relative select-none py-1">
			<div className="pointer-events-none absolute bottom-4 left-[11px] top-4 w-px bg-border/40">
				{flatItems
					.filter((item) => item.depth === 0)
					.map((item) => {
						// 刻度按 depth0 章节在拍平序列中的真实索引定位，与列表位置一一对应
						const tickIndex = flatItems.findIndex((i) => i.node.id === item.node.id);
						return (
							<span
								key={`tick-${item.node.id}`}
								className="absolute -left-1 h-px w-2 bg-border/80 transition-colors"
								style={{ top: `${(tickIndex / (flatItems.length - 1)) * 100}%` }}
							/>
						);
					})}
			</div>

			<ul className="space-y-1 pl-6">
				{flatItems.map(({ node, depth, indexStr }) => {
					const isActive = node.id === activeId;

					return (
						<li
							key={node.id}
							ref={isActive ? activeItemRef : undefined}
							className="relative flex h-9 items-center"
						>
							{isActive && (
								<motion.div
									layoutId="liquid-pill-active"
									transition={reduced ? instantTransition : springTransition}
									className="absolute inset-0 -inset-x-1 z-0 rounded-md bg-foreground/[0.045] dark:bg-foreground/[0.07]"
								/>
							)}

							<button
								type="button"
								onClick={() => onNavigate(node.id)}
								className={cn(
									"group relative z-10 flex w-full cursor-pointer items-baseline text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
									depth === 0 && "text-[13px] font-medium",
									depth === 1 && "pl-3 text-[12.5px]",
									depth === 2 && "pl-6 text-[11.5px]",
									isActive
										? "font-semibold text-foreground"
										: "text-muted-foreground/80 hover:text-foreground",
								)}
							>
								<span
									className={cn(
										"mr-2 font-mono text-[10px] tracking-wider transition-colors",
										isActive
											? "text-foreground/70"
											: "text-muted-foreground/40 group-hover:text-muted-foreground/70",
										depth > 0 && "text-[9px]",
									)}
								>
									{indexStr}
								</span>
								<span className="min-w-0 flex-1 truncate">{node.title}</span>
							</button>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}

/* =========================================================================
 * 方案 2: Monograph Index (典藏索表 - 1:1 原位几何对齐)
 * ========================================================================= */
function MonographIndex({ nodes, activeId, onNavigate, compact = false }: TocVariantProps) {
	const reduced = useReducedMotion();
	const flatItems = useMemo(() => flattenTree(nodes, ARTICLE), [nodes]);
	const [hoveredId, setHoveredId] = useState<string | null>(null);

	if (compact) {
		return (
			<nav aria-label="典藏索表收起模式" className="relative flex flex-col py-1 font-mono">
				<div className="pointer-events-none absolute bottom-4 left-1/2 top-4 w-px -translate-x-1/2 border-l border-dotted border-border/60" />

				<ul className="space-y-1">
					{flatItems.map((item) => {
						const isActive = item.node.id === activeId;
						const isHovered = item.node.id === hoveredId;

						return (
							<li
								key={item.node.id}
								className="relative flex h-8 items-center justify-center"
								onMouseEnter={() => setHoveredId(item.node.id)}
								onMouseLeave={() => setHoveredId(null)}
							>
								{isActive && (
									<motion.span
										layoutId="monograph-compact-active"
										transition={reduced ? instantTransition : springTransition}
										className="pointer-events-none absolute inset-0.5 rounded-md bg-foreground/[0.06]"
									/>
								)}
								<button
									type="button"
									onClick={() => onNavigate(item.node.id)}
									aria-label={`跳转至 ${item.node.title}`}
									className={cn(
										"relative z-10 flex cursor-pointer items-center justify-center rounded-md border font-semibold transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
										item.depth === 0
											? "size-6.5 text-[9.5px]"
											: item.depth === 1
												? "size-5 text-[8.5px]"
												: "size-4 text-[7px]",
										isActive
											? "border-foreground bg-foreground text-background shadow-xs"
											: "border-border/60 bg-muted/40 text-muted-foreground hover:border-foreground/50 hover:text-foreground",
									)}
								>
									{item.depth === 0
										? item.indexStr
										: item.depth === 1
											? item.indexStr.split(".")[1]
											: "•"}
								</button>

								<AnimatePresence>
									{isHovered && <RailHoverTooltip item={item} />}
								</AnimatePresence>
							</li>
						);
					})}
				</ul>
			</nav>
		);
	}

	return (
		<nav aria-label="典藏刊物文章目录" className="relative py-1 font-mono text-xs">
			<ul className="space-y-1">
				{flatItems.map(({ node, depth, indexStr }) => {
					const isActive = node.id === activeId;

					return (
						<li key={node.id} className="flex h-8 items-center">
							<button
								type="button"
								onClick={() => onNavigate(node.id)}
								className={cn(
									"group flex w-full cursor-pointer items-center text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
									depth === 0 && "font-serif text-[13px] tracking-normal",
									depth === 1 && "pl-3 text-[11.5px] font-sans tracking-tight",
									depth === 2 &&
										"pl-6 text-[11px] font-sans text-muted-foreground/70",
									isActive
										? "font-semibold text-foreground"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								<span
									className={cn(
										"shrink-0 font-mono text-[10px] tracking-wider",
										isActive
											? "text-foreground"
											: "text-muted-foreground/45 group-hover:text-muted-foreground/70",
									)}
								>
									{depth === 0 ? `§ ${indexStr}` : indexStr}
								</span>

								<span className="mx-2 truncate font-sans">{node.title}</span>
								<span className="mx-1 min-w-4 flex-1 border-b border-dotted border-border/50 transition-opacity group-hover:border-foreground/30" />

								<span
									className={cn(
										"shrink-0 font-mono text-[9px] tracking-widest transition-all",
										isActive
											? "translate-x-0 text-foreground opacity-100"
											: "-translate-x-1 text-muted-foreground/0 opacity-0 group-hover:translate-x-0 group-hover:text-muted-foreground/40 group-hover:opacity-100",
									)}
								>
									{isActive ? "●" : "◦"}
								</span>
							</button>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}

/* =========================================================================
 * 方案 3: Kinetic Branch (贝塞尔生长树 - 1:1 原位几何对齐)
 * ========================================================================= */
interface BranchNodeProps {
	node: TocNode;
	depth: number;
	activeId: string;
	activeChain: string[];
	collapsedIds: Set<string>;
	onNavigate: (id: string) => void;
	onToggle: (id: string) => void;
	activeItemRef?: RefObject<HTMLLIElement | null>;
}

function BranchNode({
	node,
	depth,
	activeId,
	activeChain,
	collapsedIds,
	onNavigate,
	onToggle,
	activeItemRef,
}: BranchNodeProps) {
	const reduced = useReducedMotion();
	const hasChildren = Boolean(node.children?.length);
	const isCollapsed = collapsedIds.has(node.id);
	const isActive = node.id === activeId;
	const isInActiveChain = activeChain.includes(node.id);

	return (
		<li ref={isActive ? activeItemRef : undefined} className="relative">
			<div className="group relative flex h-8 items-center gap-1.5">
				<button
					type="button"
					onClick={() => onNavigate(node.id)}
					className={cn(
						"relative flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
						depth === 0 ? "font-medium" : "text-[12px]",
						isActive
							? "font-semibold text-foreground"
							: isInActiveChain
								? "text-foreground/90"
								: "text-muted-foreground hover:text-foreground",
					)}
					aria-label={`定位到 ${node.title}`}
				>
					<span className="flex size-4.5 shrink-0 items-center justify-center">
						<span
							className={cn(
								"size-2 rounded-full border transition-all duration-300",
								isActive
									? "border-foreground bg-foreground shadow-[0_0_8px_rgba(0,0,0,0.2)] dark:shadow-[0_0_8px_rgba(255,255,255,0.4)]"
									: isInActiveChain
										? "border-foreground/60 bg-background"
										: "border-border/80 bg-muted/40 group-hover:border-foreground/50",
							)}
						/>
					</span>
					<span className="min-w-0 flex-1 truncate text-[13px]">{node.title}</span>
				</button>

				{hasChildren && (
					<button
						type="button"
						aria-expanded={!isCollapsed}
						aria-label={isCollapsed ? `展开 ${node.title}` : `收起 ${node.title}`}
						onClick={() => onToggle(node.id)}
						className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
					>
						<ChevronRight
							className={cn(
								"size-3 transition-transform duration-200",
								!isCollapsed && "rotate-90",
							)}
						/>
					</button>
				)}
			</div>

			<AnimatePresence initial={false}>
				{hasChildren && !isCollapsed && (
					<motion.div
						initial={reduced ? false : { height: 0, opacity: 0 }}
						animate={{ height: "auto", opacity: 1 }}
						exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
						transition={reduced ? instantTransition : springTransition}
						className="relative ml-2 overflow-hidden border-l border-border/50 pl-3"
					>
						<ul className="space-y-1">
							{node.children?.map((child) => (
								<BranchNode
									key={child.id}
									node={child}
									depth={depth + 1}
									activeId={activeId}
									activeChain={activeChain}
									collapsedIds={collapsedIds}
									onNavigate={onNavigate}
									onToggle={onToggle}
									activeItemRef={activeItemRef}
								/>
							))}
						</ul>
					</motion.div>
				)}
			</AnimatePresence>
		</li>
	);
}

function KineticBranch(props: TocVariantProps) {
	const reduced = useReducedMotion();
	const activeChain = useMemo(
		() => getActiveAncestorIds(props.nodes, props.activeId),
		[props.nodes, props.activeId],
	);
	const flatItems = useMemo(() => flattenTree(props.nodes, ARTICLE), [props.nodes]);
	const [hoveredId, setHoveredId] = useState<string | null>(null);

	// 激活链上的折叠节点自动展开：折叠是视图选择，追踪链不能断在折叠子树里
	useEffect(() => {
		const collapsedOnChain = [...props.collapsedIds].filter((id) => activeChain.includes(id));
		if (collapsedOnChain.length === 0) return;
		for (const id of collapsedOnChain) props.onToggle(id);
	}, [activeChain, props.collapsedIds, props.onToggle]);

	if (props.compact) {
		return (
			<nav aria-label="贝塞尔树收起光纤" className="relative flex flex-col py-1">
				<div className="pointer-events-none absolute bottom-4 left-1/2 top-4 w-px -translate-x-1/2 bg-border/40" />

				<ul className="space-y-1">
					{flatItems.map((item) => {
						const isActive = item.node.id === props.activeId;
						const isInChain = activeChain.includes(item.node.id);
						const isHovered = item.node.id === hoveredId;

						return (
							<li
								key={item.node.id}
								className="relative flex h-8 items-center justify-center"
								onMouseEnter={() => setHoveredId(item.node.id)}
								onMouseLeave={() => setHoveredId(null)}
							>
								{isActive && (
									<motion.span
										layoutId="kinetic-compact-active"
										transition={reduced ? instantTransition : springTransition}
										className="pointer-events-none absolute inset-0.5 rounded-md border border-foreground/10 bg-foreground/[0.05]"
									/>
								)}
								<button
									type="button"
									onClick={() => props.onNavigate(item.node.id)}
									aria-label={`跳转至 ${item.node.title}`}
									className="relative flex size-5 cursor-pointer items-center justify-center p-0.5 focus-visible:outline-none"
								>
									<span
										className={cn(
											"rounded-full transition-all",
											isActive
												? "size-3 bg-foreground ring-4 ring-foreground/20 shadow-xs"
												: isInChain
													? "size-2.5 border-2 border-foreground bg-background"
													: item.depth === 0
														? "size-2.5 border border-border bg-muted"
														: "size-1.5 border border-border/80 bg-muted/60 hover:scale-125 hover:border-foreground",
										)}
									/>
								</button>

								<AnimatePresence>
									{isHovered && <RailHoverTooltip item={item} />}
								</AnimatePresence>
							</li>
						);
					})}
				</ul>
			</nav>
		);
	}

	return (
		<nav aria-label="贝塞尔生长树文章目录" className="relative py-1">
			<ul className="space-y-1">
				{props.nodes.map((node) => (
					<BranchNode
						key={node.id}
						node={node}
						depth={0}
						activeId={props.activeId}
						activeChain={activeChain}
						collapsedIds={props.collapsedIds}
						onNavigate={props.onNavigate}
						onToggle={props.onToggle}
						activeItemRef={props.activeItemRef}
					/>
				))}
			</ul>
		</nav>
	);
}

/* =========================================================================
 * 方案 5: Spatial Minimap (空间微地图 - 1:1 原位几何对齐)
 * ========================================================================= */
function SpatialMinimap({ nodes, activeId, onNavigate, compact = false }: TocVariantProps) {
	const reduced = useReducedMotion();
	const flatItems = useMemo(() => flattenTree(nodes, ARTICLE), [nodes]);
	const [hoveredId, setHoveredId] = useState<string | null>(null);
	const activeIndex = flatItems.findIndex((item) => item.node.id === activeId);
	const lensHeight = Math.max(100 / flatItems.length, 12);
	const lensTop = (activeIndex >= 0 ? activeIndex / flatItems.length : 0) * (100 - lensHeight);

	const mapItems = (
		<div
			role="group"
			aria-label="全文位置缩略轨"
			className={cn(
				"relative flex flex-col justify-between border border-border/50 bg-muted/20",
				compact ? "rounded-lg p-1" : "rounded-full px-1 py-2",
			)}
		>
			<motion.div
				className="pointer-events-none absolute inset-x-0.5 z-10 rounded-full border border-foreground/30 bg-foreground/[0.06]"
				style={{ height: `${lensHeight}%` }}
				animate={{ top: `${lensTop}%` }}
				transition={reduced ? instantTransition : springTransition}
			/>
			{flatItems.map(({ node, depth }) => {
				const isActive = node.id === activeId;
				return (
					<button
						key={`bar-${node.id}`}
						type="button"
						onClick={() => onNavigate(node.id)}
						onMouseEnter={() => setHoveredId(node.id)}
						onMouseLeave={() => setHoveredId(null)}
						aria-label={`跳转到 ${node.title}`}
						className={cn(
							"group relative z-20 flex w-full cursor-pointer items-center justify-center focus-visible:outline-none",
							compact ? "h-8" : "h-3",
						)}
					>
						<span
							className={cn(
								"block rounded-full transition-all",
								depth === 0
									? "h-1 w-3.5"
									: depth === 1
										? "h-0.5 w-2.5"
										: "h-0.5 w-1.5",
								isActive
									? "bg-foreground shadow-xs"
									: depth === 0
										? "bg-foreground/40 group-hover:bg-foreground/70"
										: "bg-muted-foreground/30 group-hover:bg-foreground/50",
							)}
						/>
					</button>
				);
			})}
		</div>
	);

	if (compact) {
		return (
			<nav aria-label="全景空间微地图收起雷达" className="relative flex flex-col py-1">
				{mapItems}
				<AnimatePresence>
					{hoveredId && (
						<RailHoverTooltip
							item={
								flatItems.find((item) => item.node.id === hoveredId) ?? flatItems[0]
							}
						/>
					)}
				</AnimatePresence>
			</nav>
		);
	}

	return (
		<nav aria-label="全景空间微地图文章目录" className="relative select-none py-1">
			<div className="grid grid-cols-[1fr_1.5rem] gap-3">
				<ul className="space-y-1">
					{flatItems.map(({ node, depth, indexStr }) => {
						const isActive = node.id === activeId;
						return (
							<li key={node.id} className="flex h-8 items-center">
								<button
									type="button"
									onClick={() => onNavigate(node.id)}
									onMouseEnter={() => setHoveredId(node.id)}
									onMouseLeave={() => setHoveredId(null)}
									className={cn(
										"group flex w-full cursor-pointer items-baseline truncate rounded-md px-1.5 py-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
										depth === 0 && "text-[13px] font-medium",
										depth === 1 && "pl-3 text-[12px]",
										depth === 2 && "pl-5 text-[11px]",
										isActive
											? "bg-foreground/[0.06] font-semibold text-foreground dark:bg-foreground/[0.1]"
											: "text-muted-foreground hover:text-foreground",
									)}
								>
									<span className="mr-1.5 font-mono text-[9px] text-muted-foreground/50">
										{indexStr}
									</span>
									<span className="truncate">{node.title}</span>
								</button>
							</li>
						);
					})}
				</ul>
				{mapItems}
			</div>

			{hoveredId && (
				<div className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 rounded-md border border-border/80 bg-popover/95 p-2 text-[11px] text-popover-foreground shadow-md backdrop-blur-xs">
					<p className="font-medium">
						{flatItems.find((item) => item.node.id === hoveredId)?.node.title}
					</p>
					<p className="line-clamp-1 text-[10px] text-muted-foreground">
						{flatItems.find((item) => item.node.id === hoveredId)?.sectionData?.lead}
					</p>
				</div>
			)}
		</nav>
	);
}

/* =========================================================================
 * 导出主分发组件
 * ========================================================================= */
export function TocVariantView({ variant, ...props }: TocVariantProps & { variant: TocVariant }) {
	switch (variant) {
		case "liquid":
			return <LiquidRail {...props} />;
		case "monograph":
			return <MonographIndex {...props} />;
		case "kinetic":
			return <KineticBranch {...props} />;
		case "capsule":
			return (
				<SegmentedArticleToc
					nodes={props.nodes}
					activeId={props.activeId}
					onNavigate={props.onNavigate}
					compact={props.compact}
				/>
			);
		case "minimap":
			return <SpatialMinimap {...props} />;
	}
}
