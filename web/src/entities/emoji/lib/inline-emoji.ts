import type { InlineEmoji } from "@shared/lib/inline-emoji";
import { toEmojiToken } from "../model/token";
import type { Emoji, EmojiGroup } from "../model/types";

/** 将表情实体投影为正文编辑器所需的最小显示信息；颜文字不携带图片地址。 */
export function toInlineEmoji(emoji: Emoji): InlineEmoji {
	const token = toEmojiToken(emoji);
	if (emoji.meta?.type === 4) {
		return { token, text: token };
	}
	return {
		token,
		src: emoji.gif_url || emoji.url || undefined,
		text: emoji.text_content || emoji.name,
		size: emoji.meta?.size,
	};
}

/** 分组只用于业务选择器，编辑器只接收扁平的占位符显示列表。 */
export function toInlineEmojis(groups: readonly EmojiGroup[]): InlineEmoji[] {
	return groups.flatMap((group) =>
		group.emojis.map((emoji) =>
			toInlineEmoji(
				group.type === 1 ? { ...emoji, meta: { ...emoji.meta, type: 4 } } : emoji,
			),
		),
	);
}
