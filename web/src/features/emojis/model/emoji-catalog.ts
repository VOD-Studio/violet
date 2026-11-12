import { emojiKey } from "@entities/emoji/model/recent";
import type { Emoji, EmojiGroup } from "@entities/emoji/model/types";
import type { MineCustomEmojis } from "@features/customemoji/model/types";

const TEXT_GROUP_TYPE = 1;
const LARGE_EMOJI_SIZE = 2;
const MEMBER_EMOJI_TYPE = 2;
const PURCHASED_EMOJI_TYPE = 3;
const TEXT_EMOJI_TYPE = 4;

/** 公开分组保持统一密度，最近使用可混合三种密度。 */
export type EmojiDensity = "small" | "large" | "text";

/** 当前入口可见的表情目录；分组元数据已合并到每个条目。 */
export interface EmojiDirectory {
	groups: readonly EmojiGroup[];
	/** null 表示入口隐藏个人表情；等待个人请求时使用空集合。 */
	personal: MineCustomEmojis | null;
	/** system:<数字 ID> 与 custom:<UUID> 分开索引，不依赖临时负数 ID。 */
	byKey: ReadonlyMap<string, Emoji>;
}

/**
 * 继承分组元数据，保留单个表情覆盖；颜文字组始终按原文插入。
 *
 * @param personal - null 排除个人表情，不把不可见的缓存条目加入索引。
 */
export function createEmojiDirectory(
	groups: readonly EmojiGroup[],
	personal: MineCustomEmojis | null,
): EmojiDirectory {
	const byKey = new Map<string, Emoji>();
	const normalizedGroups = groups.map((group) => {
		const emojis = group.emojis.map((emoji) => {
			const meta = { ...group.meta, ...emoji.meta };
			if (group.type === TEXT_GROUP_TYPE) {
				meta.type = TEXT_EMOJI_TYPE;
			}
			const normalized = { ...emoji, meta };
			byKey.set(emojiKey(normalized), normalized);
			return normalized;
		});
		return { ...group, emojis };
	});

	if (personal) {
		for (const collection of [personal.owned, personal.favorited]) {
			for (const emoji of collection) {
				byKey.set(emojiKey(emoji), emoji);
			}
		}
	}
	return { groups: normalizedGroups, personal, byKey };
}

/** 不同密度的最近记录分区显示，避免把大表情压进小格。 */
export function getEmojiDensity(emoji: Emoji): EmojiDensity {
	if (emoji.meta?.type === TEXT_EMOJI_TYPE) {
		return "text";
	}
	if (emoji.custom_emoji_id || emoji.meta?.size === LARGE_EMOJI_SIZE) {
		return "large";
	}
	return "small";
}

/** 公开分组沿用分组规格；混合最近列表按单条表情决定密度。 */
export function getEmojiGroupDensity(group: EmojiGroup): EmojiDensity {
	if (group.type === TEXT_GROUP_TYPE) {
		return "text";
	}
	if (group.meta?.size === LARGE_EMOJI_SIZE) {
		return "large";
	}
	return "small";
}

/** 预览说明与实际选择使用同一可用性规则。 */
export function getEmojiUnavailableReason(emoji: Emoji): string | undefined {
	switch (emoji.meta?.type) {
		case MEMBER_EMOJI_TYPE:
			return "会员专属表情，当前不可用";
		case PURCHASED_EMOJI_TYPE:
			return "购买后可用";
		default:
			return undefined;
	}
}
