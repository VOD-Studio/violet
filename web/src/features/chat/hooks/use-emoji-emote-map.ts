/**
 * 全站表情表 → [name] 占位符映射，供消息正文渲染 emote。
 */
import { toEmojiToken } from "@entities/emoji/model/token";
import { useAllEmojis } from "@features/emojis/api/queries";
import { useMemo } from "react";

export function useEmojiEmoteMap(): Record<
	string,
	{ url: string; gif_url?: string; size?: number }
> {
	const { data: groups = [] } = useAllEmojis();
	return useMemo(() => {
		const map: Record<string, { url: string; gif_url?: string; size?: number }> = {};
		for (const group of groups) {
			for (const emoji of group.emojis) {
				const key = toEmojiToken(emoji);
				map[key] = {
					url: emoji.url || emoji.text_content || "",
					gif_url: emoji.gif_url,
					size: emoji.meta?.size,
				};
			}
		}
		return map;
	}, [groups]);
}
