import { cn } from "@shared/lib/utils";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

export interface SegmentedTocNode {
	id: string;
	title: string;
	children?: SegmentedTocNode[];
}

export interface SegmentedArticleTocProps {
	nodes: SegmentedTocNode[];
	activeId: string | null;
	onNavigate: (id: string) => void;
	compact?: boolean;
}

interface FlatItem {
	node: SegmentedTocNode;
	depth: number;
	indexLabel: string;
	topId: string;
}

const springTransition = { type: "spring" as const, stiffness: 380, damping: 30 };
const instantTransition = { duration: 0 };

function flattenNodes(nodes: SegmentedTocNode[], depth = 0, prefix = "", topId = ""): FlatItem[] {
	return nodes.flatMap((node, index) => {
		const segment = String(index + 1).padStart(2, "0");
		const indexLabel = prefix ? `${prefix}.${index + 1}` : segment;
		const rootId = topId || node.id;
		return [
			{ node, depth, indexLabel, topId: rootId },
			...flattenNodes(node.children ?? [], depth + 1, indexLabel, rootId),
		];
	});
}

/** 实验室与博客详情共用的分段手风琴目录。 */
export function SegmentedArticleToc({
	nodes,
	activeId,
	onNavigate,
	compact = false,
}: SegmentedArticleTocProps) {
	const reduced = useReducedMotion();
	const flatItems = useMemo(() => flattenNodes(nodes), [nodes]);
	const activeItem = flatItems.find((item) => item.node.id === activeId);
	const activeTopId = activeItem?.topId ?? nodes[0]?.id ?? "";
	const [collapsedOverride, setCollapsedOverride] = useState<string | null>(null);
	const expandedId = collapsedOverride === activeTopId ? null : activeTopId;
	const rootRef = useRef<HTMLElement>(null);
	const [activeBox, setActiveBox] = useState({ top: 0, height: 0 });

	useEffect(() => {
		if (collapsedOverride === null || collapsedOverride === activeTopId) return;
		setCollapsedOverride(null);
	}, [activeTopId, collapsedOverride]);

	useLayoutEffect(() => {
		const root = rootRef.current;
		if (!root || compact || !activeTopId) return;
		const card = root.querySelector<HTMLElement>(`[data-toc-card="${activeTopId}"]`);
		if (!card) return;
		const measure = () => {
			setActiveBox({ top: card.offsetTop - root.clientTop, height: card.offsetHeight });
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(root);
		observer.observe(card);
		return () => observer.disconnect();
	}, [activeTopId, compact]);

	if (compact) {
		return (
			<nav
				ref={rootRef}
				aria-label="分段手风琴收起目录"
				className="relative flex flex-col space-y-2 py-1"
			>
				{nodes.map((node, index) => {
					const branch = flatItems.filter((item) => item.topId === node.id);
					const isActive = node.id === activeTopId;
					const visible = expandedId === node.id ? branch : branch.slice(0, 1);
					return (
						<div
							key={node.id}
							className={cn(
								"relative flex flex-col items-center rounded-lg border p-1 transition-colors",
								isActive ? "border-transparent" : "border-border/60 bg-muted/20",
							)}
						>
							{isActive ? (
								<motion.span
									layoutId="segmented-compact-active"
									transition={reduced ? instantTransition : springTransition}
									className="pointer-events-none absolute inset-0 rounded-lg border border-foreground/30 bg-foreground/[0.04] shadow-xs"
								/>
							) : null}
							<div className="relative z-10 flex flex-col items-center gap-1.5 py-1">
								{visible.map((item) => (
									<button
										key={item.node.id}
										type="button"
										onClick={() => {
											setCollapsedOverride(null);
											onNavigate(item.node.id);
										}}
										aria-label={`跳转至 ${item.node.title}`}
										className={cn(
											"flex cursor-pointer items-center justify-center rounded-xs focus-visible:outline-none",
											item.depth === 0
												? "size-5 text-[8px] font-mono font-bold"
												: "size-3.5",
											item.node.id === activeId
												? "bg-foreground text-background shadow-xs"
												: "text-muted-foreground hover:bg-foreground/20",
										)}
									>
										{item.depth === 0 ? (
											index + 1
										) : (
											<span className="size-1 rounded-full bg-current" />
										)}
									</button>
								))}
							</div>
						</div>
					);
				})}
			</nav>
		);
	}

	return (
		<nav
			ref={rootRef}
			aria-label="分段手风琴文章目录"
			className="relative flex flex-col space-y-2 py-1"
		>
			<motion.div
				className="pointer-events-none absolute inset-x-0 top-0 z-0 rounded-xl border border-foreground/20 bg-foreground/[0.02] shadow-xs dark:border-foreground/25 dark:bg-foreground/[0.04]"
				animate={{ y: activeBox.top, height: activeBox.height }}
				transition={reduced ? instantTransition : springTransition}
			/>
			{nodes.map((node, index) => {
				const branchItems = flatItems.filter(
					(item) => item.topId === node.id && item.depth > 0,
				);
				const isExpanded = expandedId === node.id;
				const isActive = activeTopId === node.id;
				return (
					<div
						key={node.id}
						data-toc-card={node.id}
						className={cn(
							"relative z-10 rounded-xl border bg-background/50 transition-colors",
							isActive
								? "border-transparent"
								: "border-border/50 hover:border-border/80",
						)}
					>
						<div
							role="button"
							tabIndex={0}
							onClick={() => {
								setCollapsedOverride(null);
								onNavigate(node.id);
							}}
							onKeyDown={(event) => {
								if (event.key !== "Enter" && event.key !== " ") return;
								event.preventDefault();
								setCollapsedOverride(null);
								onNavigate(node.id);
							}}
							className="relative z-10 flex cursor-pointer items-center justify-between gap-2 rounded-t-xl p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>
							<div className="flex min-w-0 flex-1 items-baseline gap-2">
								<span className="font-mono text-[11px] font-semibold text-muted-foreground/60">
									{String(index + 1).padStart(2, "0")}
								</span>
								<span
									className={cn(
										"truncate text-[13.5px]",
										isActive
											? "font-semibold text-foreground"
											: "text-muted-foreground",
									)}
								>
									{node.title}
								</span>
							</div>
							{branchItems.length ? (
								<div className="flex items-center gap-1.5">
									<span className="rounded-full bg-muted/70 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
										{branchItems.length}
									</span>
									<button
										type="button"
										aria-expanded={isExpanded}
										aria-label={
											isExpanded ? `收起 ${node.title}` : `展开 ${node.title}`
										}
										onClick={(event) => {
											event.stopPropagation();
											setCollapsedOverride(isExpanded ? node.id : null);
										}}
										className="grid size-6 cursor-pointer place-items-center rounded-md text-muted-foreground/70 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
									>
										<ChevronDown
											className={cn(
												"size-3.5 transition-transform duration-200",
												!isExpanded && "-rotate-90",
											)}
										/>
									</button>
								</div>
							) : null}
						</div>
						<AnimatePresence initial={false} mode="popLayout">
							{isExpanded && branchItems.length ? (
								<motion.div
									key={node.id}
									initial={reduced ? false : { opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									transition={
										reduced
											? instantTransition
											: { duration: 0.18, ease: "easeOut" }
									}
									className="relative z-10 overflow-hidden border-t border-border/40 bg-muted/15 px-3 py-2"
								>
									<ul className="space-y-1">
										{branchItems.map((item) => (
											<li key={item.node.id}>
												<button
													type="button"
													onClick={() => onNavigate(item.node.id)}
													className={cn(
														"flex w-full cursor-pointer items-center rounded-md px-2 py-1 text-left transition-colors",
														item.depth > 1
															? "pl-4 text-[11.5px]"
															: "text-[12.5px]",
														item.node.id === activeId
															? "bg-foreground/[0.08] font-medium text-foreground"
															: "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
													)}
												>
													<span className="mr-2 font-mono text-[9px] text-muted-foreground/50">
														{item.indexLabel}
													</span>
													<span className="truncate">
														{item.node.title}
													</span>
												</button>
											</li>
										))}
									</ul>
								</motion.div>
							) : null}
						</AnimatePresence>
					</div>
				);
			})}
		</nav>
	);
}
