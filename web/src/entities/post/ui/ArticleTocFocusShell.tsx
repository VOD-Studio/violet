import { cn } from "cn";
import { type FocusEvent, type ReactNode, type RefObject, useLayoutEffect, useState } from "react";

import { ArticleTocRail } from "./ArticleTocRail";
import { type ArticleTocRailItem, useArticleReadPercent } from "./article-toc-rail-motion";

interface ArticleTocFocusShellProps {
	items: ArticleTocRailItem[];
	activeId: string | null;
	contentRef?: RefObject<HTMLElement | null>;
	/** 展开态切换通知；收起(true)→展开(false)时目录列表需滚回当前阅读位置。 */
	onRailActiveChange?: (active: boolean) => void;
	children: (railActive: boolean) => ReactNode;
}

/** 在阅读轨迹与完整目录之间按悬停、键盘焦点切换。 */
export function ArticleTocFocusShell({
	items,
	activeId,
	contentRef,
	onRailActiveChange,
	children,
}: ArticleTocFocusShellProps) {
	const [isHovered, setIsHovered] = useState(false);
	const [hasFocusWithin, setHasFocusWithin] = useState(false);
	const railActive = !isHovered && !hasFocusWithin;
	useLayoutEffect(() => {
		onRailActiveChange?.(railActive);
	}, [onRailActiveChange, railActive]);
	const activeIndex = Math.max(
		0,
		items.findIndex((item) => item.id === activeId),
	);
	const fallbackPercent = items.length > 1 ? (activeIndex / (items.length - 1)) * 100 : 0;
	const readPercent = useArticleReadPercent(contentRef, fallbackPercent);

	return (
		<div
			data-toc-focus={railActive ? "" : undefined}
			role="group"
			aria-label="文章目录；悬停或聚焦以展开完整目录"
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			onFocusCapture={() => setHasFocusWithin(true)}
			onBlurCapture={(event: FocusEvent<HTMLDivElement>) => {
				const nextTarget = event.relatedTarget;
				if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
					setHasFocusWithin(false);
				}
			}}
			className="relative h-[55vh] max-h-[calc(100vh-8rem)] w-[calc(100%+1.5rem)] rounded-xl"
		>
			<button
				type="button"
				aria-label="展开完整目录"
				aria-expanded={!railActive}
				className={cn(
					"absolute inset-0 z-20 cursor-default rounded-xl bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4",
					!railActive && "pointer-events-none",
				)}
			/>
			<div
				aria-hidden={railActive}
				inert={railActive}
				className={cn(
					"absolute inset-x-0 top-0 flex max-h-full flex-col px-2 motion-safe:transition-opacity motion-safe:duration-180 motion-safe:ease-out",
					railActive ? "pointer-events-none opacity-0" : "opacity-100",
				)}
			>
				{children(railActive)}
				<div className="mt-4 shrink-0 pl-2">
					<svg
						aria-hidden="true"
						viewBox="0 0 208 12"
						preserveAspectRatio="none"
						className="h-3 w-full text-border"
					>
						<path
							d="M1 6 C21 0 41 0 61 6 S101 12 121 6 S161 0 181 6 S201 12 207 8"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.5"
						/>
					</svg>
					<div
						className="mt-4 flex items-center gap-2.5 text-sm text-foreground"
						role="progressbar"
						aria-label="阅读进度"
						aria-valuemin={0}
						aria-valuemax={100}
						aria-valuenow={readPercent}
					>
						<svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 -rotate-90">
							<circle
								cx="12"
								cy="12"
								r="9"
								fill="none"
								stroke="currentColor"
								strokeWidth="2.5"
								className="text-border"
							/>
							<circle
								cx="12"
								cy="12"
								r="9"
								fill="none"
								stroke="currentColor"
								strokeWidth="2.5"
								pathLength={100}
								strokeDasharray={100}
								strokeDashoffset={100 - readPercent}
								strokeLinecap="round"
								className="text-primary motion-safe:transition-[stroke-dashoffset] motion-safe:duration-300"
							/>
						</svg>
						<span className="tabular-nums">{readPercent}%</span>
					</div>
				</div>
			</div>
			<ArticleTocRail
				items={items}
				activeId={activeId}
				active={railActive}
				readPercent={readPercent}
				contentRef={contentRef}
			/>
		</div>
	);
}
