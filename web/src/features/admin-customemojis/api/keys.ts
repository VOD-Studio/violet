import type { PageQuery } from "@shared/api/types";

/** adminCustomEmojiKeys - 后台自定义表情 query key 工厂 */
export const adminCustomEmojiKeys = {
	all: ["admin-custom-emojis"] as const,
	list: (keyword: string, query: PageQuery) =>
		[...adminCustomEmojiKeys.all, "list", keyword, query] as const,
};
