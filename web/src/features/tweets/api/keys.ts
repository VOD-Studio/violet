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

/** 推文模块根 key（提取为常量，供 timeline/detail 维度派生） */
const tweetsRoot = ["tweets"] as const;

export const tweetKeys = {
	/** 推文模块根 key */
	all: tweetsRoot,
	/** 时间线根维度：各 limit 子 key 的公共前缀，用于批量缓存操作 */
	timeline: [...tweetsRoot, "timeline"] as const,
	/** 全局时间线维度（按 limit 区分） */
	timelineOf: (limit: number = TIMELINE_PAGE_SIZE) =>
		[...tweetKeys.timeline, { limit } satisfies TimelineKeyShape] as const,
	/** 单条推文详情维度（按 id 区分） */
	detail: (id: string) => [...tweetsRoot, "detail", id] as const,
	/** 用户推文列表维度（按 username 与 limit 区分） */
	userTimelineOf: (username: string, limit: number = TIMELINE_PAGE_SIZE) =>
		[...tweetsRoot, "userTimeline", username, { limit }] as const,
	/** 用户公开资料卡维度（按 username 区分） */
	userProfile: (username: string) => [...tweetsRoot, "userProfile", username] as const,
};
