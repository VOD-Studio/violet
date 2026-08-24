/**
 * customEmojiKeys - 自定义表情 query key 工厂
 */
export const customEmojiKeys = {
	/** 自定义表情模块根 key */
	all: ["custom-emojis"] as const,
	/** 我的表情（按账号会话版本隔离） */
	mine: (sessionVersion = 0) => [...customEmojiKeys.all, "mine", sessionVersion] as const,
};
