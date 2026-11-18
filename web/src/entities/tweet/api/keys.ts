import type { CommentSort } from "@entities/comment/model/types";
import type { TweetTimelineSort } from "../model/types";

/** 推文读取与互动的缓存键，供推文和聊天入口复用。 */

/** 全局时间线每页条数（cursor 滚动加载，与评论 TOP_LEVEL_PAGE_SIZE 对齐） */
export const TIMELINE_PAGE_SIZE = 20;

/** 推文模块根 key（提取为常量，供 timeline/detail 维度派生） */
const tweetsRoot = ["tweets"] as const;

export const tweetKeys = {
	/** 推文模块根 key */
	all: tweetsRoot,
	/** 排序为缓存前缀；cursor 仍是每页的 pageParam。 */
	timeline: [...tweetsRoot, "timeline"] as const,
	timelineSorted: (sort: TweetTimelineSort) => [...tweetKeys.timeline, sort] as const,
	timelineOf: (limit: number = TIMELINE_PAGE_SIZE, sort: TweetTimelineSort = "latest") =>
		[...tweetKeys.timelineSorted(sort), { limit }] as const,
	sidebar: [...tweetsRoot, "sidebar"] as const,
	userTimeline: [...tweetsRoot, "userTimeline"] as const,
	topicTimeline: [...tweetsRoot, "topicTimeline"] as const,
	/** 单条推文详情维度（按 id 区分） */
	detail: (id: string) => [...tweetsRoot, "detail", id] as const,
	/** 用户推文列表维度（按 username 与 limit 区分） */
	userTimelineOf: (username: string, limit: number = TIMELINE_PAGE_SIZE) =>
		[...tweetKeys.userTimeline, username, { limit }] as const,
	/** 话题推文列表维度（按 tag 与 limit 区分） */
	topicTimelineOf: (tag: string, limit: number = TIMELINE_PAGE_SIZE) =>
		[...tweetKeys.topicTimeline, tag, { limit }] as const,
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
