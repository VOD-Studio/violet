import { toEmojiToken } from "@entities/emoji/model/token";
import type { Emoji } from "@entities/emoji/model/types";
import { isImageURL } from "@shared/lib/url";

/** 表情的图片或文本内容，外层选项负责提供可访问名称。 */
export interface EmojiContentProps {
	emoji: Emoji;
}

/** 图片名称由所在选项或回应按钮播报，图片本身不重复提供名称。 */
export function EmojiContent({ emoji }: EmojiContentProps) {
	if (emoji.meta?.type === 4) {
		return toEmojiToken(emoji);
	}
	const source = emoji.gif_url || emoji.url;
	if (!isImageURL(source)) {
		return emoji.text_content ?? emoji.name.replace(/^\[|\]$/g, "");
	}
	return (
		<img
			src={source}
			alt=""
			loading="lazy"
			data-custom-emoji-id={emoji.custom_emoji_id}
			data-relation={emoji.relation}
		/>
	);
}
