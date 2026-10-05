"use client";

import type { TweetSnapshot } from "../data/types.js";
import { safeUrl } from "../data/urls.js";
import { TweetLink } from "./primitives.js";

interface TweetTextProps {
	text: TweetSnapshot["text"];
	segments: TweetSnapshot["segments"];
}

/** 完整展示正文和安全链接，保留原始文字与换行。 */
export function TweetText({ text, segments }: TweetTextProps) {
	return (
		<p className="v-tweet__text" dir="auto">
			{segments?.length
				? segments.map((segment, index) =>
						segment.kind !== "text" && safeUrl(segment.url) ? (
							<TweetLink key={`${index}:${segment.kind}`} href={segment.url}>
								{segment.text}
							</TweetLink>
						) : (
							<span key={`${index}:${segment.kind}`}>{segment.text}</span>
						),
					)
				: text}
		</p>
	);
}
