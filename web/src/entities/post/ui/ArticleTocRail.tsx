import { cn } from "cn";
import type { CSSProperties, RefObject } from "react";

import { ARTICLE_TOC_RAIL_ACCENT } from "./article-toc-rail-geometry";
import { type ArticleTocRailItem, useArticleTocRailMotion } from "./article-toc-rail-motion";

interface ArticleTocRailProps {
	items: ArticleTocRailItem[];
	activeId: string | null;
	active: boolean;
	readPercent: number;
	contentRef?: RefObject<HTMLElement | null>;
	className?: string;
}

/** 文章阅读轨迹；路径按正文标题位置和滚动速度逐帧形变。 */
export function ArticleTocRail({
	items,
	activeId,
	active,
	readPercent,
	contentRef,
	className,
}: ArticleTocRailProps) {
	const { accentPathRef, activeRootItem, basePathRef, containerRef, labelRef, markerRefs } =
		useArticleTocRailMotion({ active, activeId, contentRef, items, readPercent });
	if (items.length === 0) return null;

	return (
		<div
			aria-hidden="true"
			data-toc-rail
			ref={containerRef}
			className={cn(
				"pointer-events-none absolute inset-y-0 left-0 w-12 motion-safe:transition-opacity motion-safe:duration-180 motion-safe:ease-out",
				active ? "opacity-100" : "opacity-0",
				className,
			)}
			style={{ "--toc-rail-accent": ARTICLE_TOC_RAIL_ACCENT } as CSSProperties}
		>
			<svg
				className="absolute inset-0 size-full overflow-visible"
				aria-hidden="true"
				focusable="false"
			>
				<path
					data-toc-rail-path="base"
					ref={basePathRef}
					fill="none"
					stroke="currentColor"
					strokeWidth="1.2"
					className="text-muted-foreground/15"
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
					className="opacity-55"
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
							className="motion-safe:transition-[r,fill] motion-safe:duration-200 motion-safe:ease-out"
							style={
								{
									fill,
									r: `${radius}px`,
								} as CSSProperties & { r: string }
							}
						/>
					);
				})}
			</svg>

			<div
				ref={labelRef}
				data-toc-rail-label
				className="absolute top-0 left-9 flex flex-col gap-0.5"
			>
				{activeRootItem ? (
					<span className="block max-w-46 truncate text-[10px] leading-tight text-muted-foreground">
						{activeRootItem.title}
					</span>
				) : null}
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
