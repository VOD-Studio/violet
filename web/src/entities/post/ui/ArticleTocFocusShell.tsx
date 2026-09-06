import { cn } from "@shared/lib/utils";
import { type FocusEvent, type ReactNode, type RefObject, useState } from "react";

import { ArticleTocRail } from "./ArticleTocRail";
import type { ArticleTocRailItem } from "./article-toc-rail-motion";

interface ArticleTocFocusShellProps {
	items: ArticleTocRailItem[];
	activeId: string | null;
	contentRef?: RefObject<HTMLElement | null>;
	children: (railActive: boolean) => ReactNode;
}

/** 在阅读轨迹与完整目录之间按悬停、键盘焦点切换。 */
export function ArticleTocFocusShell({
	items,
	activeId,
	contentRef,
	children,
}: ArticleTocFocusShellProps) {
	const [isHovered, setIsHovered] = useState(false);
	const [hasFocusWithin, setHasFocusWithin] = useState(false);
	const railActive = !isHovered && !hasFocusWithin;

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
			className="relative h-[calc(100vh-8rem)] min-h-96 max-h-224 rounded-xl"
		>
			<button
				type="button"
				aria-label="展开完整目录"
				className={cn(
					"absolute inset-0 z-20 cursor-default rounded-xl bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4",
					!railActive && "pointer-events-none",
				)}
			/>
			<div
				className={cn(
					"absolute inset-x-0 top-0 flex max-h-[75vh] flex-col overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
					railActive && "pointer-events-none",
				)}
			>
				{children(railActive)}
			</div>
			<ArticleTocRail
				items={items}
				activeId={activeId}
				active={railActive}
				contentRef={contentRef}
			/>
		</div>
	);
}
