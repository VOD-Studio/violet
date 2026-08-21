/**
 * TweetContent - 推文正文组件
 *
 * 将正文中的 #话题# 解析为跳转到 /tweets/topics/$tag 的 Clickable Link，
 * 将正文中的 [name] 占位符解析为内联表情图片，阻止冒泡避免触发整卡点击进入详情页。
 */

import type { TweetEmoteRef } from "@entities/tweet/model/types";
import { EmojiText } from "@shared/ui/emoji-text";
import { Link } from "@tanstack/react-router";
import type React from "react";

const HASHTAG_REGEX = /#([^#\r\n]{1,50})#/g;

export interface TweetContentProps {
	/** 推文正文 */
	content: string;
	/** 表情映射表，key 为 [name]，value 为表情图片 URL */
	emote?: Record<string, TweetEmoteRef>;
	className?: string;
}
export function TweetContent({ content, emote, className }: TweetContentProps) {
	if (!content) return null;

	const elements: React.ReactNode[] = [];
	let lastIndex = 0;
	let match: RegExpExecArray | null;

	// 重置正则 lastIndex
	HASHTAG_REGEX.lastIndex = 0;

	while (true) {
		match = HASHTAG_REGEX.exec(content);
		if (!match) break;
		const matchStart = match.index;
		const matchEnd = HASHTAG_REGEX.lastIndex;
		const fullMatch = match[0];
		const tagName = match[1];

		// 匹配前的普通文本（支持表情）
		if (matchStart > lastIndex) {
			const textChunk = content.slice(lastIndex, matchStart);
			elements.push(<EmojiText key={`text-${lastIndex}`} text={textChunk} emote={emote} />);
		}
		elements.push(
			<Link
				key={`${matchStart}-${tagName}`}
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

	// 剩余文本（支持表情）
	if (lastIndex < content.length) {
		const textChunk = content.slice(lastIndex);
		elements.push(<EmojiText key={`text-${lastIndex}`} text={textChunk} emote={emote} />);
	}
	return (
		<p
			className={`whitespace-pre-wrap wrap-break-word text-sm leading-relaxed text-foreground ${className ?? ""}`}
		>
			{elements}
		</p>
	);
}

export default TweetContent;
