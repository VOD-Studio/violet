import type { Tweet } from "@entities/tweet/model/types";
import { HASHTAG_REGEX } from "../ui/TweetContent";

/** 「近期」的统计窗口，天。 */
const RECENT_DAYS = 30;
const MAX_TOPICS = 8;

/** 由已加载推文推出的用户动态概览。 */
export interface ProfileActivity {
	/** 最新一条推文的创建时间；没有推文时为空。 */
	latestAt?: string;
	/** 近 30 天已加载的推文数。 */
	recentCount: number;
	/** 已加载推文的累计点赞数。 */
	likeCount: number;
	/** 常用话题，按出现次数降序、同次数按最近出现排序。 */
	topics: { tag: string; count: number }[];
	/** 还有未加载的推文，上述数字只是下限。 */
	partial: boolean;
}

/**
 * 汇总已加载推文的动态概览，只统计手头数据，不发起请求。
 *
 * @param tweets - 按时间倒序的已加载推文
 * @param hasNextPage - 是否还有未加载的页；为 true 时数字只是下限，界面应加「+」
 * @param now - 当前时间，便于测试
 */
export function summarizeActivity(
	tweets: Tweet[],
	hasNextPage: boolean,
	now = new Date(),
): ProfileActivity {
	const since = now.getTime() - RECENT_DAYS * 24 * 60 * 60 * 1000;
	const counts = new Map<string, number>();
	let recentCount = 0;
	let likeCount = 0;
	for (const tweet of tweets) {
		if (Date.parse(tweet.created_at) >= since) recentCount++;
		likeCount += tweet.like_count;
		for (const match of tweet.content.matchAll(HASHTAG_REGEX)) {
			const tag = match[1].trim();
			if (tag) counts.set(tag, (counts.get(tag) ?? 0) + 1);
		}
	}
	// Map 保持首次出现顺序，而推文是新到旧，稳定排序后同次数的话题最近出现的靠前。
	const topics = [...counts]
		.map(([tag, count]) => ({ tag, count }))
		.sort((a, b) => b.count - a.count)
		.slice(0, MAX_TOPICS);
	return {
		latestAt: tweets[0]?.created_at,
		recentCount,
		likeCount,
		topics,
		partial: hasNextPage,
	};
}
