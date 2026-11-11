import type { Emoji } from "@entities/emoji/model/types";
import type { AggregatedReaction, ReactionUser } from "../model/types";

export interface ReactionSnapshot {
	/** undefined 表示请求前不存在该表情。 */
	reaction: AggregatedReaction | undefined;
	/** 原列表中的位置；目标不存在时为 -1。 */
	index: number;
}

/** 保存目标原值与位置，供请求失败时定点回滚。 */
export function captureReaction(
	reactions: AggregatedReaction[],
	emojiId: number,
): ReactionSnapshot {
	const index = reactions.findIndex((reaction) => reaction.emoji_id === emojiId);
	return { index, reaction: reactions[index] };
}

/** 只修改当前用户的回应；保留现有 GIF 与其余参与者的公开名字。 */
export function addSelfReaction(
	reactions: AggregatedReaction[],
	emojiId: number,
	user: ReactionUser,
	emoji?: Emoji,
): AggregatedReaction[] {
	const existing = reactions.find((reaction) => reaction.emoji_id === emojiId);
	if (existing?.self) {
		return reactions;
	}
	if (!existing) {
		if (!emoji) {
			return reactions;
		}
		return [
			...reactions,
			{
				emoji_id: emoji.id,
				emoji_name: emoji.name,
				emoji_url: emoji.url,
				gif_url: emoji.gif_url,
				count: 1,
				self: true,
				recent_users: [user],
			},
		];
	}
	return reactions.map((reaction) => {
		if (reaction !== existing) {
			return reaction;
		}
		return {
			...reaction,
			count: reaction.count + 1,
			self: true,
			recent_users: [
				user,
				...reaction.recent_users.filter((entry) => entry.id !== user.id),
			].slice(0, 3),
		};
	});
}

/** 最后一位参与者取消时移除整项，其余情况同步计数与公开名单。 */
export function removeSelfReaction(
	reactions: AggregatedReaction[],
	emojiId: number,
	userId: string,
): AggregatedReaction[] {
	return reactions.flatMap((reaction) => {
		if (reaction.emoji_id !== emojiId || !reaction.self) {
			return [reaction];
		}
		if (reaction.count <= 1) {
			return [];
		}
		return [
			{
				...reaction,
				count: reaction.count - 1,
				self: false,
				recent_users: reaction.recent_users.filter((user) => user.id !== userId),
			},
		];
	});
}

/** 失败只恢复目标表情，不覆盖同一列表中其他回应或消息的并发更新。 */
export function restoreReaction(
	reactions: AggregatedReaction[],
	emojiId: number,
	previous: ReactionSnapshot,
): AggregatedReaction[] {
	const index = reactions.findIndex((reaction) => reaction.emoji_id === emojiId);
	const original = previous.reaction;
	if (!original) {
		return reactions.filter((reaction) => reaction.emoji_id !== emojiId);
	}
	if (index < 0) {
		const restored = [...reactions];
		restored.splice(previous.index, 0, original);
		return restored;
	}
	return reactions.map((reaction, position) => (position === index ? original : reaction));
}
