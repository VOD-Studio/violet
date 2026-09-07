import { cn } from "@shared/lib/utils";
import { ChevronDown } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { type MouseEvent, type RefObject, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArticleTocFocusShell } from "./ArticleTocFocusShell";
import type { ArticleTocRailItem } from "./article-toc-rail-motion";
import { CompactArticleToc } from "./CompactArticleToc";

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
	isRailCollapsedAtRest?: boolean;
	contentRef?: RefObject<HTMLElement | null>;
}

interface FlatItem extends ArticleTocRailItem {
	indexLabel: string;
}

const settledTransition = { type: "tween" as const, duration: 0.2, ease: "easeOut" as const };
const instantTransition = { duration: 0 };

function flattenNodes(nodes: SegmentedTocNode[], depth = 0, prefix = "", topId = ""): FlatItem[] {
	return nodes.flatMap((node, index) => {
		const segment = String(index + 1).padStart(2, "0");
		const indexLabel = prefix ? `${prefix}.${index + 1}` : segment;
		const rootId = topId || node.id;
		return [
			{ id: node.id, title: node.title, depth, indexLabel, topId: rootId },
			...flattenNodes(node.children ?? [], depth + 1, indexLabel, rootId),
		];
	});
}

function handleHeadingClick(
	event: MouseEvent<HTMLAnchorElement>,
	id: string,
	onNavigate: (id: string) => void,
) {
	if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
		return;
	}
	event.preventDefault();
	const href = `#${encodeURIComponent(id)}`;
	if (window.location.hash !== href) window.history.pushState(null, "", href);
	onNavigate(id);
}

/** 实验室与博客详情共用的分段手风琴目录。 */
export function SegmentedArticleToc({
	nodes,
	activeId,
	onNavigate,
	compact = false,
	isRailCollapsedAtRest = false,
	contentRef,
}: SegmentedArticleTocProps) {
	const reduced = useReducedMotion();
	const flatItems = useMemo(() => flattenNodes(nodes), [nodes]);
	const activeItem = flatItems.find((item) => item.id === activeId);
	const activeTopId = activeItem?.topId ?? nodes[0]?.id ?? "";
	const activeFlatIndex = Math.max(
		0,
		flatItems.findIndex((item) => item.id === activeId),
	);
	const rippleDelayByTopId = useMemo(
		() =>
			new Map(
				nodes.map((node) => {
					const rootIndex = flatItems.findIndex((item) => item.id === node.id);
					return [
						node.id,
						Math.min(450, 50 * Math.abs(rootIndex - activeFlatIndex)),
					] as const;
				}),
			),
		[activeFlatIndex, flatItems, nodes],
	);
	const [expansion, setExpansion] = useState(() => ({
		activeTopId,
		expandedId: activeTopId || null,
	}));
	const expandedId =
		expansion.activeTopId === activeTopId ? expansion.expandedId : activeTopId || null;
	const updateExpandedId = (id: string | null) => setExpansion({ activeTopId, expandedId: id });
	const rootRef = useRef<HTMLDivElement>(null);
	const [activeBox, setActiveBox] = useState({ top: 0, height: 0 });

	useLayoutEffect(() => {
		if (expansion.activeTopId === activeTopId) return;
		setExpansion({ activeTopId, expandedId: activeTopId || null });
	}, [activeTopId, expansion.activeTopId]);

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
			<CompactArticleToc
				nodes={nodes}
				items={flatItems}
				activeId={activeId}
				activeTopId={activeTopId}
				expandedId={expandedId}
				onExpandedIdChange={updateExpandedId}
				onNavigate={(event, id) => handleHeadingClick(event, id, onNavigate)}
			/>
		);
	}

	const renderAccordion = (railActive: boolean) => (
		<div
			ref={rootRef}
			aria-label="分段手风琴文章目录"
			role="group"
			data-toc-accordion
			className="relative flex flex-col space-y-2 py-1"
		>
			<motion.div
				className={cn(
					"pointer-events-none absolute inset-x-0 top-0 z-0 rounded-xl border border-foreground/20 bg-foreground/[0.02] shadow-xs transition-opacity duration-300 dark:border-foreground/25 dark:bg-foreground/[0.04]",
					railActive && "opacity-0",
				)}
				animate={{ y: activeBox.top, height: activeBox.height }}
				transition={reduced ? instantTransition : settledTransition}
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
							"relative z-10 rounded-xl border bg-background/50 transition-[opacity,translate,border-color,background-color] duration-350 ease-[cubic-bezier(0.4,0,0.2,1)]",
							railActive && "-translate-x-2.5 opacity-0",
							isActive
								? "border-transparent"
								: "border-border/50 hover:border-border/80",
						)}
						style={{
							transitionDelay: railActive
								? `${rippleDelayByTopId.get(node.id) ?? 0}ms`
								: "0ms",
						}}
					>
						<div className="relative z-10 flex items-center gap-2">
							<a
								href={`#${node.id}`}
								onClick={(event) => {
									updateExpandedId(node.id);
									handleHeadingClick(event, node.id, onNavigate);
								}}
								aria-label={node.title}
								aria-current={isActive ? "location" : undefined}
								className="flex min-w-0 flex-1 cursor-pointer items-baseline gap-2 rounded-l-xl p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							>
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
							</a>
							{branchItems.length ? (
								<div className="flex items-center gap-1.5 pr-2">
									<span className="rounded-full bg-muted/70 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
										{branchItems.length}
									</span>
									<button
										type="button"
										aria-expanded={isExpanded}
										aria-label={
											isExpanded ? `收起 ${node.title}` : `展开 ${node.title}`
										}
										onClick={() =>
											updateExpandedId(isExpanded ? null : node.id)
										}
										className="grid size-6 cursor-pointer place-items-center rounded-md text-muted-foreground/70 transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
						{isExpanded && branchItems.length ? (
							<motion.div
								key={node.id}
								initial={reduced ? false : { opacity: 0 }}
								animate={{ opacity: 1 }}
								transition={
									reduced
										? instantTransition
										: { duration: 0.18, ease: "easeOut" }
								}
								className="relative z-10 overflow-hidden border-t border-border/40 bg-muted/15 px-3 py-2"
							>
								<ul className="space-y-1">
									{branchItems.map((item) => (
										<li key={item.id}>
											<a
												href={`#${item.id}`}
												onClick={(event) =>
													handleHeadingClick(event, item.id, onNavigate)
												}
												aria-label={item.title}
												aria-current={
													item.id === activeId ? "location" : undefined
												}
												className={cn(
													"flex w-full cursor-pointer items-center rounded-md px-2 py-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
													item.depth > 1
														? "pl-4 text-[11.5px]"
														: "text-[12.5px]",
													item.id === activeId
														? "bg-foreground/[0.08] font-medium text-foreground"
														: "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
												)}
											>
												<span className="mr-2 font-mono text-[9px] text-muted-foreground/50">
													{item.indexLabel}
												</span>
												<span className="truncate">{item.title}</span>
											</a>
										</li>
									))}
								</ul>
							</motion.div>
						) : null}
					</div>
				);
			})}
		</div>
	);

	if (!isRailCollapsedAtRest) return renderAccordion(false);

	return (
		<ArticleTocFocusShell items={flatItems} activeId={activeId} contentRef={contentRef}>
			{renderAccordion}
		</ArticleTocFocusShell>
	);
}
