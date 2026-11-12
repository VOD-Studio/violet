import type { CommentSort } from "@entities/comment/model/types";

/** 推文读取与互动的缓存键，供推文和聊天入口复用。 */

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
	/** 话题推文列表维度（按 tag 与 limit 区分） */
	topicTimelineOf: (tag: string, limit: number = TIMELINE_PAGE_SIZE) =>
		[...tweetsRoot, "topicTimeline", tag, { limit }] as const,
	/** 同一推文全部顶层排序的公共缓存前缀。 */
	commentList: (tweetId: string) => [...tweetsRoot, "comments", "list", tweetId] as const,
	/** 顶层评论的真实排序维度；page 仍由无限查询持有。 */
	commentListOf: (tweetId: string, sort: CommentSort = "latest") =>
		[...tweetKeys.commentList(tweetId), { sort }] as const,
	/** 不放进 comments 前缀，避免评论增删的列表更新器误处理回应数组。 */
	commentReactions: (tweetId: string) => [...tweetsRoot, "comment-reactions", tweetId] as const,
	commentReactionList: (tweetId: string, commentId: string) =>
		[...tweetKeys.commentReactions(tweetId), commentId] as const,
	commentReactionBatch: (tweetId: string, commentIds: readonly string[]) =>
		[...tweetKeys.commentReactions(tweetId), "batch", commentIds] as const,
	/** 推文评论某顶层评论下的回复维度（按 commentId 聚合，含 page 维度） */
	replies: (commentId: string) => [...tweetsRoot, "comments", "replies", commentId] as const,
};
