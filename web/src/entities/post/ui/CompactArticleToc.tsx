import { cn } from "@shared/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import type { MouseEvent } from "react";
import type { ArticleTocRailItem } from "./article-toc-rail-motion";
import type { SegmentedTocNode } from "./SegmentedArticleToc";

interface CompactArticleTocProps {
	nodes: SegmentedTocNode[];
	items: ArticleTocRailItem[];
	activeId: string | null;
	activeTopId: string;
	expandedId: string | null;
	onExpandedIdChange: (id: string) => void;
	onNavigate: (event: MouseEvent<HTMLAnchorElement>, id: string) => void;
}

const settledTransition = { type: "tween" as const, duration: 0.2, ease: "easeOut" as const };
const instantTransition = { duration: 0 };

/** 分段目录的窄栏形态，以章节胶囊和子标题节点保留完整层级。 */
export function CompactArticleToc({
	nodes,
	items,
	activeId,
	activeTopId,
	expandedId,
	onExpandedIdChange,
	onNavigate,
}: CompactArticleTocProps) {
	const reduced = useReducedMotion();

	return (
		<div
			role="group"
			aria-label="分段手风琴收起目录"
			className="relative flex flex-col space-y-2 py-1"
		>
			{nodes.map((node, index) => {
				const branch = items.filter((item) => item.topId === node.id);
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
								transition={reduced ? instantTransition : settledTransition}
								className="pointer-events-none absolute inset-0 rounded-lg border border-foreground/30 bg-foreground/[0.04] shadow-xs"
							/>
						) : null}
						<div className="relative z-10 flex flex-col items-center gap-1.5 py-1">
							{visible.map((item) => (
								<a
									key={item.id}
									href={`#${item.id}`}
									onClick={(event) => {
										onExpandedIdChange(item.topId);
										onNavigate(event, item.id);
									}}
									aria-label={`跳转至 ${item.title}`}
									aria-current={item.id === activeId ? "location" : undefined}
									className={cn(
										"flex cursor-pointer items-center justify-center rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
										item.depth === 0
											? "size-5 text-[8px] font-mono font-bold"
											: "size-3.5",
										item.id === activeId
											? "bg-foreground text-background shadow-xs"
											: "text-muted-foreground hover:bg-foreground/20",
									)}
								>
									{item.depth === 0 ? (
										index + 1
									) : (
										<span className="size-1 rounded-full bg-current" />
									)}
								</a>
							))}
						</div>
					</div>
				);
			})}
		</div>
	);
}
