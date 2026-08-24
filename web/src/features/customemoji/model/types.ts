/**
 * customemoji 模块类型定义
 *
 * 自定义表情：用户自助上传、默认私有，需收藏才能被他人选用（PRD-0020，见
 * docs/adr/0013-custom-emoji-private-favorite-model.md）。后端读模型转出为
 * entities/emoji 的 Emoji 读模型，复用现有 EmojiPicker 网格渲染；custom_emoji_id/
 * relation 区分自定义表情与系统表情。
 */
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
 * toMineCustomEmojis - 后端聚合读模型转出为 Emoji[]。
 *
 * 自定义表情 ID 是 UUID 字符串，而 Emoji.id 沿用系统表情的 number 契约（历史遗留，
 * 影响面太大不改），故合成负数占位（系统表情 ID 恒为正，不会与合成值冲突）；
 * 真实身份落在 custom_emoji_id，插入 token / 收藏 / 删除等操作均按它取值。
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
