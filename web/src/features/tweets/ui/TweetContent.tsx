import type { TweetEmoteRef } from "@entities/tweet/model/types";
import { displayUrl, tokenizeLinks } from "@shared/lib/linkify";
import { EmojiText } from "@shared/ui/emoji-text";
import { Link } from "@tanstack/react-router";
import type React from "react";

export const HASHTAG_REGEX = /#([^#\r\n]{1,50})#/g;

export interface TweetContentProps {
	/** 推文正文 */
	content: string;
	/** 表情映射表，key 为 [name]，value 为表情图片 URL */
	emote?: Record<string, TweetEmoteRef>;
	className?: string;
}

/**
 * 正文三级切分：URL > `#话题#` > `[emote]`。
 *
 * 先切 URL（fragment 里的 `#` 不被话题吞并），URL 之外的文本块再走话题切分，
 * 话题之外的纯文本交给 EmojiText 做表情替换。
 */
export function TweetContent({ content, emote, className }: TweetContentProps) {
	if (!content) return null;

	const elements: React.ReactNode[] = [];
	let cursor = 0;
	for (const link of tokenizeLinks(content)) {
		if (link.start > cursor) {
			elements.push(...renderChunk(content.slice(cursor, link.start), cursor, emote));
		}
		elements.push(
			<a
				key={`link-${link.start}`}
				href={link.href}
				target="_blank"
				rel="noopener noreferrer nofollow"
				onClick={(e) => e.stopPropagation()}
				className="wrap-break-word text-primary hover:underline"
			>
				{displayUrl(link.text)}
			</a>,
		);
		cursor = link.end;
	}
	if (cursor < content.length) {
		elements.push(...renderChunk(content.slice(cursor), cursor, emote));
	}

	return (
		<p
			className={`whitespace-pre-wrap wrap-break-word text-sm leading-relaxed text-foreground ${className ?? ""}`}
		>
			{elements}
		</p>
	);
}

/** 单个非 URL 文本块的 `#话题#` 切分；话题之外的文本支持表情。 */
function renderChunk(
	chunk: string,
	base: number,
	emote?: Record<string, TweetEmoteRef>,
): React.ReactNode[] {
	const elements: React.ReactNode[] = [];
	let lastIndex = 0;
	let match: RegExpExecArray | null;

	// 共享正则实例，进入前重置 lastIndex（与原实现一致）
	HASHTAG_REGEX.lastIndex = 0;

	while ((match = HASHTAG_REGEX.exec(chunk)) !== null) {
		const matchStart = match.index;
		const matchEnd = HASHTAG_REGEX.lastIndex;
		const fullMatch = match[0];
		const tagName = match[1];

		if (matchStart > lastIndex) {
			elements.push(
				<EmojiText
					key={`text-${base + lastIndex}`}
					text={chunk.slice(lastIndex, matchStart)}
					emote={emote}
				/>,
			);
		}
		elements.push(
			<Link
				key={`tag-${base + matchStart}-${tagName}`}
				to="/tweets/topics/$tag"
				params={{ tag: tagName }}
				onClick={(e) => e.stopPropagation()}
				className="font-medium text-primary hover:underline"
			>
				{fullMatch}
			</Link>,
		);

		lastIndex = matchEnd;
	}
	if (lastIndex < chunk.length) {
		elements.push(
			<EmojiText key={`text-${base + lastIndex}`} text={chunk.slice(lastIndex)} emote={emote} />,
		);
	}
	return elements;
}

export default TweetContent;
