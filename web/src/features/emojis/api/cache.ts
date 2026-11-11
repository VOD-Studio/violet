import type { EmojiGroup } from "@entities/emoji/model/types";
import type { QueryClient } from "@tanstack/react-query";
import { emojiKeys } from "./keys";

/** 只读取当前系统分组缓存，不请求目录或访问个人表情。 */
export function findCachedEmoji(queryClient: QueryClient, emojiId: number) {
	const groups = queryClient.getQueryData<EmojiGroup[]>(emojiKeys.publicGroupList());
	for (const group of groups ?? []) {
		const emoji = group.emojis.find((entry) => entry.id === emojiId);
		if (emoji) {
			return emoji;
		}
	}
	return undefined;
}
