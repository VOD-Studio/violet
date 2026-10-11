/**
 * EmojiText - 表情文本渲染组件
 *
 * 将文本中的 [name] 占位符替换为内联表情图片。使用 React 元素渲染（非 innerHTML），
 * 文本段由 React 自动转义，无 XSS 风险。
 *
 * emote 映射由后端 CommentDTO.emote 提供，key 为含方括号的完整占位符（如 "[doge]"）。
 * 未匹配的 [name] 保持原文显示。
 */
import type { CommentEmoteRef } from "@entities/comment/model/types";
import { isImageURL } from "@shared/lib/url";
import { Fragment, type ReactNode } from "react";

export interface EmojiTextProps {
	/** 待解析的文本，可能包含 [name] 占位符 */
	text: string;
	/** 表情映射表，key 为 "[name]"，value 为图片 URL */
	emote?: Record<string, CommentEmoteRef>;
	/** 外层样式 */
	className?: string;
}

const EMOJI_PATTERN = /\[([^\]]+)\]/g;

/** 整条文本只由表情组成且不超过此数量时按「表情包」放大显示，像聊天里单发表情 */
const JUMBO_MAX_COUNT = 4;

/**
 * 表情图片尺寸 class。size=2 为作者选的大表情；自定义表情是用户上传的图片，
 * 内联时也要比系统表情大得多才看得清，单发时再放大一档。
 */
function emojiSizeClass(ref: CommentEmoteRef, jumbo: boolean): string {
	const large = ref.size === 2;
	if (ref.custom_emoji_id) {
		if (jumbo) return large ? "size-24" : "size-16";
		return large ? "size-20" : "size-9";
	}
	if (jumbo) return large ? "size-14" : "size-10";
	return large ? "size-10" : "size-5";
}

/** 文本去掉空白后是否只剩已知表情占位符（至多 JUMBO_MAX_COUNT 个） */
function isEmojiOnly(text: string, emote: Record<string, CommentEmoteRef>): boolean {
	const rest = text.replace(EMOJI_PATTERN, (token) => (emote[token] ? "" : token)).trim();
	const count = [...text.matchAll(EMOJI_PATTERN)].filter((m) => emote[m[0]]).length;
	return rest === "" && count > 0 && count <= JUMBO_MAX_COUNT;
}

export function EmojiText({ text, emote, className }: EmojiTextProps) {
	return <span className={className}>{parseEmojiText(text, emote)}</span>;
}

function parseEmojiText(text: string, emote?: Record<string, CommentEmoteRef>): ReactNode[] {
	if (!emote || text.length === 0) {
		return [text];
	}

	const jumbo = isEmojiOnly(text, emote);
	const nodes: ReactNode[] = [];
	let lastIndex = 0;
	let key = 0;

	EMOJI_PATTERN.lastIndex = 0;

	let match: RegExpExecArray | null = EMOJI_PATTERN.exec(text);
	while (match !== null) {
		const [fullMatch] = match;
		const startIndex = match.index;

		if (startIndex > lastIndex) {
			nodes.push(<Fragment key={key++}>{text.slice(lastIndex, startIndex)}</Fragment>);
		}

		const ref = emote[fullMatch];
		if (ref) {
			const src = ref.gif_url || ref.url;
			if (src && isImageURL(src)) {
				nodes.push(
					<img
						key={key++}
						src={src}
						alt={fullMatch}
						data-custom-emoji-id={ref.custom_emoji_id}
						data-relation={ref.custom_emoji_id ? (ref.relation ?? "none") : undefined}
						className={`inline-block object-contain align-text-bottom ${emojiSizeClass(ref, jumbo)}`}
						loading="lazy"
					/>,
				);
			} else {
				nodes.push(<Fragment key={key++}>{src || fullMatch}</Fragment>);
			}
		} else {
			nodes.push(<Fragment key={key++}>{fullMatch}</Fragment>);
		}

		lastIndex = startIndex + fullMatch.length;
		match = EMOJI_PATTERN.exec(text);
	}

	if (lastIndex < text.length) {
		nodes.push(<Fragment key={key++}>{text.slice(lastIndex)}</Fragment>);
	}

	return nodes.length > 0 ? nodes : [text];
}
