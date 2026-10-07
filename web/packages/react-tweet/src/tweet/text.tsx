"use client";

import { useId } from "react";

import type { TweetSnapshot } from "../data/types.ts";
import { safeUrl } from "../data/urls.ts";
import type { TweetMessages } from "./localization.ts";
import { stopInteraction, TweetLink } from "./primitives.tsx";
import { useTextCollapse } from "./use-text-collapse.ts";

interface TweetTextProps {
	text: TweetSnapshot["text"];
	segments: TweetSnapshot["segments"];
	maxTextLines?: number;
	messages: TweetMessages;
}

/** 只折叠正文，保留原始文字与链接；展开按钮不触发宿主卡片导航。 */
export function TweetText({ text, segments, maxTextLines, messages }: TweetTextProps) {
	const id = useId();
	const { ref, lines, hasOverflow, isExpanded, toggle } = useTextCollapse({
		maxTextLines,
		text,
		segments,
	});
	const isCollapsed = lines !== undefined && !isExpanded;
	return (
		<>
			<p
				ref={ref}
				id={id}
				className="v-tweet__text"
				dir="auto"
				data-collapsed={isCollapsed || undefined}
				style={isCollapsed ? { WebkitLineClamp: lines } : undefined}
			>
				{segments?.length
					? segments.map((segment, index) =>
							segment.kind !== "text" && safeUrl(segment.url) ? (
								<TweetLink
									key={`${index}:${segment.kind}`}
									href={segment.url}
									tabIndex={hasOverflow && isCollapsed ? -1 : undefined}
								>
									{segment.text}
								</TweetLink>
							) : (
								<span key={`${index}:${segment.kind}`}>{segment.text}</span>
							),
						)
					: text}
			</p>
			{hasOverflow && (
				<button
					type="button"
					className="v-tweet__text-toggle"
					aria-expanded={isExpanded}
					aria-controls={id}
					onClick={(event) => {
						stopInteraction(event);
						toggle();
					}}
					onKeyDown={stopInteraction}
					onPointerDown={stopInteraction}
				>
					{isExpanded ? messages.showLess : messages.showMore}
				</button>
			)}
		</>
	);
}
