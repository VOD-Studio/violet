/** customemoji feature 的后端 DTO 与 EmojiPicker 读模型。 */
import type { Emoji } from "@entities/emoji/model/types";

/** CustomEmojiRawDTO - 单条自定义表情后端读模型（对应 application/customemoji.CustomEmojiDTO） */
export interface CustomEmojiRawDTO {
	id: string;
	name: string;
	url: string;
}

/** MineCustomEmojisRawDTO - GET /custom-emojis/mine 响应 */
export interface MineCustomEmojisRawDTO {
	owned: CustomEmojiRawDTO[];
	favorited: CustomEmojiRawDTO[];
}

/** MineCustomEmojis - 「我的表情」聚合读模型，转出为 Emoji[] 供 EmojiPicker 渲染 */
export interface MineCustomEmojis {
	owned: Emoji[];
	favorited: Emoji[];
}

/** CreateCustomEmojiInput - POST /custom-emojis 请求体（url 来自已有上传接口结果） */
export interface CreateCustomEmojiInput {
	name: string;
	url: string;
}

/**
 * 将后端表情行转为 EmojiPicker 条目。
 *
 * EmojiPicker 的本地 key 使用负数，真实自定义表情 ID 保存在 custom_emoji_id。
 */
export function toMineCustomEmojis(raw: MineCustomEmojisRawDTO): MineCustomEmojis {
	let counter = 0;
	const toEmoji = (dto: CustomEmojiRawDTO, relation: "owned" | "favorited"): Emoji => {
		counter += 1;
		return { id: -counter, name: dto.name, url: dto.url, custom_emoji_id: dto.id, relation };
	};
	return {
		owned: raw.owned.map((dto) => toEmoji(dto, "owned")),
		favorited: raw.favorited.map((dto) => toEmoji(dto, "favorited")),
	};
}
