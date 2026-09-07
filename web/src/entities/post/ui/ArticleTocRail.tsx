import { cn } from "@shared/lib/utils";
import { AnimatePresence, motion } from "motion/react";
import type { CSSProperties, RefObject } from "react";

import { ARTICLE_TOC_RAIL_ACCENT } from "./article-toc-rail-geometry";
import { type ArticleTocRailItem, useArticleTocRailMotion } from "./article-toc-rail-motion";

interface ArticleTocRailProps {
	items: ArticleTocRailItem[];
	activeId: string | null;
	active: boolean;
	contentRef?: RefObject<HTMLElement | null>;
	className?: string;
}

/** 文章阅读轨迹；路径按正文标题位置和滚动速度逐帧形变。 */
export function ArticleTocRail({
	items,
	activeId,
	active,
	contentRef,
	className,
}: ArticleTocRailProps) {
	const {
		accentPathRef,
		activeRootItem,
		basePathRef,
		containerRef,
		labelRef,
		markerRefs,
		readPercent,
	} = useArticleTocRailMotion({ active, activeId, contentRef, items });

	if (items.length === 0) return null;

	return (
		<div
			aria-hidden="true"
			data-toc-rail
			ref={containerRef}
			className={cn("pointer-events-none absolute inset-y-0 left-0 w-12", className)}
			style={{ "--toc-rail-accent": ARTICLE_TOC_RAIL_ACCENT } as CSSProperties}
		>
			<svg
				className="absolute inset-0 size-full overflow-visible"
				aria-hidden="true"
				focusable="false"
				style={{
					clipPath: active
						? "inset(-2% -50% -2% -2%)"
						: `inset(${readPercent}% -50% ${100 - readPercent}% -2%)`,
					transition: `clip-path ${active ? 550 : 450}ms cubic-bezier(0.4, 0, 0.2, 1)`,
				}}
			>
				<path
					data-toc-rail-path="base"
					ref={basePathRef}
					fill="none"
					stroke="currentColor"
					strokeWidth="1.2"
					className={cn(
						"text-muted-foreground/15 transition-opacity",
						active
							? "opacity-100 delay-100 duration-200"
							: "opacity-0 delay-0 duration-450",
					)}
				/>
				<path
					data-toc-rail-path="accent"
					ref={accentPathRef}
					fill="none"
					pathLength={1}
					stroke="var(--toc-rail-accent)"
					strokeDasharray="0.12 0.88"
					strokeLinecap="round"
					strokeWidth="1.6"
					className={cn(
						"transition-opacity",
						active
							? "opacity-55 delay-150 duration-300"
							: "opacity-0 delay-0 duration-200",
					)}
					style={{
						filter: "drop-shadow(0 0 4px color-mix(in srgb, var(--toc-rail-accent) 35%, transparent))",
					}}
				/>
				{items.map((item, index) => {
					const isActive = item.id === activeId;
					const radius = isActive ? 2.5 : item.depth === 0 ? 1.75 : 1.25;
					const fill = isActive
						? "color-mix(in srgb, var(--toc-rail-accent) 70%, transparent)"
						: `color-mix(in srgb, var(--muted-foreground) ${
								item.depth === 0 ? 30 : 18
							}%, transparent)`;
					return (
						<circle
							key={item.id}
							data-toc-rail-marker={item.id}
							ref={(marker) => {
								markerRefs.current[index] = marker;
							}}
							className={active ? "opacity-100" : "opacity-0"}
							style={
								{
									fill,
									r: `${radius}px`,
									transition: `opacity 300ms ${
										active ? (isActive ? 100 : 600) : 0
									}ms, r 350ms cubic-bezier(0.4, 0, 0.2, 1), fill 350ms`,
								} as CSSProperties & { r: string }
							}
						/>
					);
				})}
			</svg>

			<div
				ref={labelRef}
				data-toc-rail-label
				className={cn(
					"absolute top-0 left-9 flex flex-col gap-0.5 transition-opacity duration-300",
					active ? "opacity-100 delay-700" : "opacity-0 delay-0",
				)}
			>
				<AnimatePresence mode="wait">
					{activeRootItem ? (
						<motion.span
							key={activeRootItem.id}
							initial={{ opacity: 0, y: 3 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -3 }}
							transition={{ duration: 0.25, ease: "easeOut" }}
							className="block max-w-35 truncate text-[10px] leading-tight text-muted-foreground/40"
						>
							{activeRootItem.title}
						</motion.span>
					) : null}
				</AnimatePresence>
				<span
					className="text-[10px] tabular-nums"
					style={{
						color: "color-mix(in srgb, var(--toc-rail-accent) 50%, transparent)",
					}}
				>
					{readPercent}%
				</span>
			</div>
		</div>
	);
}
