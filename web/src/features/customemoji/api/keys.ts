/**
 * customEmojiKeys - 自定义表情 query key 工厂
 */
export const customEmojiKeys = {
	/** 自定义表情模块根 key */
	all: ["custom-emojis"] as const,
	/** 我的表情（自传 + 收藏），无参数 */
	mine: () => [...customEmojiKeys.all, "mine"] as const,
};
