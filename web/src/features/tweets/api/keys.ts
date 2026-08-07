/** tweetKeys - 推文模块 query key 工厂 */

/** 全局时间线每页条数（cursor 滚动加载，与评论 TOP_LEVEL_PAGE_SIZE 对齐） */
export const TIMELINE_PAGE_SIZE = 20;

/**
 * timelineKeyShape - 时间线 query key 的固定维度
 *
 * 仅 limit 进 key；cursor 是 pageParam，随每页变化，不在此处。
 */
interface TimelineKeyShape {
	limit: number;
}

export const tweetKeys = {
	/** 推文模块根 key */
	all: ["tweets"] as const,
	/** 全局时间线维度（按 limit 区分） */
	timeline: (limit: number = TIMELINE_PAGE_SIZE) =>
		[...tweetKeys.all, "timeline", { limit } satisfies TimelineKeyShape] as const,
};
