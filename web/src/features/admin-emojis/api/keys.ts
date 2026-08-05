/**
 * adminEmojiKeys - 后台表情管理 query key 工厂
 *
 * 集中管理后台表情 key。公开表情 key 见 emojis。
 */
export const adminEmojiKeys = {
	/** 模块根 */
	all: ["admin-emojis"] as const,
	/** 后台分组维度 */
	adminGroups: () => [...adminEmojiKeys.all, "groups"] as const,
	/** 后台全部分组列表，含未启用 */
	adminGroupList: () => [...adminEmojiKeys.adminGroups(), "list"] as const,
	/** 后台分组内表情列表 */
	adminGroupEmojis: (groupId: number) =>
		[...adminEmojiKeys.adminGroups(), "emojis", groupId] as const,
	/** B站表情重新拉取任务状态 */
	refetchStatus: () => [...adminEmojiKeys.all, "refetch-status"] as const,
	/** B站 Cookie 默认值（env 配置，用于重新拉取弹窗预填） */
	bilibiliCookie: () => [...adminEmojiKeys.all, "bilibili-cookie"] as const,
};
