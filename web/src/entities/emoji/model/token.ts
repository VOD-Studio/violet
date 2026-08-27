import type { Emoji } from "./types";

/**
 * 将系统或自定义表情读模型转换为正文占位符。
 *
 * 系统表情历史数据可能已经包含方括号；自定义表情名称保持展示名，ID 追加在末段。
 */
export function toEmojiToken(emoji: Emoji): string {
	if (emoji.custom_emoji_id) {
		return `[${emoji.name}:${emoji.custom_emoji_id}]`;
	}
	if (emoji.name.startsWith("[") && emoji.name.endsWith("]")) {
		return emoji.name;
	}
	return `[${emoji.name}]`;
}
