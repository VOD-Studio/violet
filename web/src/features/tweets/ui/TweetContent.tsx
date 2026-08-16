/**
 * TweetContent - 推文正文组件
 *
 * 将正文中的 #话题# 解析为跳转到 /tweets/topics/$tag 的 Clickable Link，
 * 阻止冒泡避免触发整卡点击进入详情页。
 */

import { Link } from "@tanstack/react-router";
import type React from "react";

const HASHTAG_REGEX = /#([^#\r\n]{1,50})#/g;

export interface TweetContentProps {
	content: string;
	className?: string;
}

export function TweetContent({ content, className }: TweetContentProps) {
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

		// 匹配前的普通文本
		if (matchStart > lastIndex) {
			elements.push(content.slice(lastIndex, matchStart));
		}

		// 话题标签 Link
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

	// 剩余文本
	if (lastIndex < content.length) {
		elements.push(content.slice(lastIndex));
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
