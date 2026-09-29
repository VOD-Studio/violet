import { handleTocLinkClick } from "@shared/hooks/use-toc";
import { cn } from "cn";
import { useReducedMotion } from "motion/react";
import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
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

interface TocAnchor {
	pageY: number;
	top: number;
	height: number;
}

function tocPositionAt(anchors: TocAnchor[], pageY: number, edge: "top" | "bottom"): number {
	let previous = anchors[0];
	const position = (anchor: TocAnchor) => anchor.top + (edge === "bottom" ? anchor.height : 0);
	if (pageY <= previous.pageY) return position(previous);
	for (let index = 1; index < anchors.length; index++) {
		const next = anchors[index];
		if (pageY < next.pageY) {
			const progress = (pageY - previous.pageY) / (next.pageY - previous.pageY);
			return position(previous) + (position(next) - position(previous)) * progress;
		}
		previous = next;
	}
	return position(previous);
}

/** 实验室与博客详情共用的文章目录。 */
export function SegmentedArticleToc({
	nodes,
	activeId,
	onNavigate,
	compact = false,
	isRailCollapsedAtRest = false,
	contentRef,
}: SegmentedArticleTocProps) {
	const flatItems = useMemo(() => flattenNodes(nodes), [nodes]);
	const activeIndex = flatItems.findIndex((item) => item.id === activeId);
	const activeItem = flatItems[activeIndex];
	const activeTopId = activeItem?.topId ?? nodes[0]?.id ?? "";
	const [expansion, setExpansion] = useState(() => ({
		activeTopId,
		expandedId: activeTopId || null,
	}));
	const expandedId =
		expansion.activeTopId === activeTopId ? expansion.expandedId : activeTopId || null;
	const updateExpandedId = (id: string | null) => setExpansion({ activeTopId, expandedId: id });
	const listRef = useRef<HTMLUListElement>(null);
	const scrollRef = useRef<HTMLDivElement>(null);
	const indicatorRef = useRef<HTMLSpanElement>(null);
	const reduced = useReducedMotion();

	// 以正文标题的文档位置为锚，视口上下沿在相邻目录行间连续插值。
	useEffect(() => {
		const body = contentRef?.current;
		const list = listRef.current;
		const indicator = indicatorRef.current;
		if (!body || !list || !indicator) return;
		const listRows = list.querySelectorAll<HTMLElement>("li");
		const rows = flatItems
			.map((item, index) => ({
				heading: body.querySelector<HTMLElement>(`[id="${CSS.escape(item.id)}"]`),
				row: listRows[index] ?? null,
			}))
			.filter((entry): entry is { heading: HTMLElement; row: HTMLElement } =>
				Boolean(entry.heading && entry.row),
			);
		if (rows.length === 0) {
			indicator.style.opacity = "0";
			return;
		}

		let anchors: TocAnchor[] = [];
		let frame = 0;
		let needsMeasure = false;
		let lastScrollTarget: number | null = null;
		const measureAnchors = () => {
			const scrollY = window.scrollY;
			anchors = rows.map(({ heading, row }) => ({
				pageY: heading.getBoundingClientRect().top + scrollY,
				top: row.offsetTop,
				height: row.offsetHeight,
			}));
		};
		const update = () => {
			// 正文标题使用 80px scroll-margin-top；阅读线也从这个视口高度起算。
			const start = tocPositionAt(anchors, window.scrollY + 80, "top");
			const end = tocPositionAt(anchors, window.scrollY + window.innerHeight, "bottom");
			indicator.style.transform = `translateY(${start}px)`;
			indicator.style.height = `${Math.max(0, end - start)}px`;
			indicator.style.opacity = "1";

			const scroll = scrollRef.current;
			if (!isRailCollapsedAtRest || !scroll || scroll.scrollHeight <= scroll.clientHeight)
				return;
			const center = (start + end) / 2;
			const visibleCenter = center - scroll.scrollTop;
			if (
				visibleCenter < scroll.clientHeight * 0.3 ||
				visibleCenter > scroll.clientHeight * 0.7
			) {
				const target = center - scroll.clientHeight / 2;
				if (lastScrollTarget === null || Math.abs(target - lastScrollTarget) > 24) {
					scroll.scrollTo({ top: target, behavior: reduced ? "instant" : "smooth" });
					lastScrollTarget = target;
				}
			}
		};
		measureAnchors();
		update();
		const schedule = (measure = false) => {
			needsMeasure ||= measure;
			if (frame) return;
			frame = requestAnimationFrame(() => {
				frame = 0;
				if (needsMeasure) {
					needsMeasure = false;
					measureAnchors();
				}
				update();
			});
		};
		const onScroll = () => schedule();
		const onResize = () => schedule(true);
		const resizeObserver = new ResizeObserver(onResize);
		resizeObserver.observe(body);
		window.addEventListener("scroll", onScroll, { passive: true });
		window.addEventListener("resize", onResize, { passive: true });
		return () => {
			resizeObserver.disconnect();
			window.removeEventListener("scroll", onScroll);
			window.removeEventListener("resize", onResize);
			if (frame) cancelAnimationFrame(frame);
		};
	}, [contentRef, flatItems, isRailCollapsedAtRest, reduced]);

	if (compact) {
		return (
			<CompactArticleToc
				nodes={nodes}
				items={flatItems}
				activeId={activeId}
				activeTopId={activeTopId}
				expandedId={expandedId}
				onExpandedIdChange={updateExpandedId}
				onNavigate={(event, id) => handleTocLinkClick(event, id, onNavigate)}
			/>
		);
	}

	const renderTocList = () => (
		<div
			aria-label="文章目录"
			role="group"
			data-toc-accordion
			ref={scrollRef}
			className={cn(
				"py-1",
				isRailCollapsedAtRest && "scrollbar-none min-h-0 max-h-60 overflow-y-auto",
			)}
		>
			<ul
				ref={listRef}
				className={cn("relative", !isRailCollapsedAtRest && "border-l border-border/60")}
			>
				<span
					ref={indicatorRef}
					aria-hidden="true"
					className={cn(
						"pointer-events-none absolute top-0 opacity-0",
						isRailCollapsedAtRest
							? "-left-0.5 w-1 bg-linear-to-b from-primary via-primary to-transparent"
							: "-left-px w-0.5 bg-primary",
					)}
				/>
				{flatItems.map((item, index) => {
					const active = item.id === activeId;
					return (
						<li key={item.id} className="relative">
							<a
								href={`#${item.id}`}
								onClick={(event) => handleTocLinkClick(event, item.id, onNavigate)}
								aria-label={item.title}
								aria-current={active ? "location" : undefined}
								className={cn(
									"block pr-2 leading-5 motion-safe:transition-colors",
									isRailCollapsedAtRest ? "py-2 text-sm" : "py-1.5 text-xs",
									item.depth === 0 ? "pl-3" : item.depth === 1 ? "pl-6" : "pl-9",
									active
										? isRailCollapsedAtRest
											? "font-medium text-primary"
											: "font-medium text-foreground"
										: isRailCollapsedAtRest
											? index < activeIndex
												? "text-muted-foreground/75 hover:text-foreground"
												: "text-muted-foreground hover:text-foreground"
											: "text-muted-foreground/70 hover:text-foreground",
								)}
							>
								{item.title}
							</a>
						</li>
					);
				})}
			</ul>
		</div>
	);

	if (!isRailCollapsedAtRest) return renderTocList();

	return (
		<ArticleTocFocusShell items={flatItems} activeId={activeId} contentRef={contentRef}>
			{renderTocList}
		</ArticleTocFocusShell>
	);
}
