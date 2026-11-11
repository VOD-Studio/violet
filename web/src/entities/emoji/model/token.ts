import type { Emoji } from "./types";

/**
 * 将表情读模型转换为可插入正文的文本。
 *
 * 系统表情历史数据可能已经包含方括号；自定义表情名称保持展示名，ID 追加在末段。
 * 颜文字直接返回原文，不套用占位符边界。
 */
export function toEmojiToken(emoji: Emoji): string {
	if (emoji.meta?.type === 4) {
		return emoji.text_content ?? emoji.name;
	}
	if (emoji.custom_emoji_id) {
		return `[${emoji.name}:${emoji.custom_emoji_id}]`;
	}
	if (emoji.name.startsWith("[") && emoji.name.endsWith("]")) {
		return emoji.name;
	}
	return `[${emoji.name}]`;
}
