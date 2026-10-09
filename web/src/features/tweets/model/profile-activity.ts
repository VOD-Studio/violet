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

/** 热力图中的一天。 */
export interface ActivityDay {
	/** 日期 YYYY-MM-DD，按站点时区。 */
	date: string;
	/** 当天已加载的推文数。 */
	count: number;
	/** 晚于今天的格子，只为让最后一周补齐成整列。 */
	future: boolean;
}

/** 近若干周的发文热力图，按列（周）优先排列，每列自周一到周日。 */
export interface ActivityGrid {
	days: ActivityDay[];
	weeks: number;
	/** 窗口内已加载的推文总数。 */
	total: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const SITE_TIME_ZONE = "Asia/Shanghai";

/**
 * 统计近若干周每天的发文数，供热力图展示。
 *
 * 日期按站点时区换算，服务端与浏览器得到同一张网格，避免 hydration 不一致。
 *
 * @param tweets - 已加载的推文
 * @param now - 当前时间，便于测试
 * @param weeks - 展示的周数，包含本周
 */
export function buildActivityGrid(tweets: Tweet[], now = new Date(), weeks = 12): ActivityGrid {
	const format = new Intl.DateTimeFormat("en-CA", {
		timeZone: SITE_TIME_ZONE,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});
	const key = (value: Date) => format.format(value);
	const counts = new Map<string, number>();
	for (const tweet of tweets) {
		const created = new Date(tweet.created_at);
		if (Number.isNaN(created.getTime())) continue;
		counts.set(key(created), (counts.get(key(created)) ?? 0) + 1);
	}
	const today = key(now);
	// 以 UTC 零点表示站点时区的日期，天数加减不受夏令时影响。
	const todayUtc = Date.parse(`${today}T00:00:00Z`);
	const weekday = (new Date(todayUtc).getUTCDay() + 6) % 7;
	const start = todayUtc - (weekday + (weeks - 1) * 7) * DAY_MS;
	const days: ActivityDay[] = [];
	let total = 0;
	for (let i = 0; i < weeks * 7; i++) {
		const date = new Date(start + i * DAY_MS).toISOString().slice(0, 10);
		const future = date > today;
		const count = future ? 0 : (counts.get(date) ?? 0);
		total += count;
		days.push({ date, count, future });
	}
	return { days, weeks, total };
}
