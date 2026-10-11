import type { Tweet } from "@entities/tweet/model/types";
import { contentImageUrl } from "@shared/lib/image-url";
import { HASHTAG_REGEX } from "../ui/TweetContent";

/** 时间线侧栏的摘要：只从已加载的推文里算，不额外请求。 */
export interface FeedInsights {
	topics: { tag: string; count: number }[];
	authors: { id: string; username: string; avatarUrl: string; count: number }[];
	photos: { src: string; tweetId: string }[];
}

const MAX_TOPICS = 8;
const MAX_AUTHORS = 6;
const MAX_PHOTOS = 9;

/**
 * 汇总已加载推文的话题、作者与图片。
 *
 * @param tweets - 按时间倒序的已加载推文
 * @returns 话题按出现次数、作者按发文数排序（同数量时越近出现越靠前）；图片按时间由新到旧，
 *   含本站图片与转发的 X 原文里的照片（视频只取封面不计入）。
 */
export function summarizeFeed(tweets: Tweet[]): FeedInsights {
	const topicCounts = new Map<string, number>();
	const authorCounts = new Map<string, FeedInsights["authors"][number]>();
	const photos: FeedInsights["photos"] = [];
	const seen = new Set<string>();

	for (const tweet of tweets) {
		for (const match of tweet.content.matchAll(HASHTAG_REGEX)) {
			const tag = match[1].trim();
			if (tag) topicCounts.set(tag, (topicCounts.get(tag) ?? 0) + 1);
		}
		const author = authorCounts.get(tweet.author.id);
		if (author) author.count++;
		else
			authorCounts.set(tweet.author.id, {
				id: tweet.author.id,
				username: tweet.author.username,
				avatarUrl: tweet.author.avatar_url,
				count: 1,
			});

		if (photos.length >= MAX_PHOTOS) continue;
		const sources = [
			...tweet.images.map((url) => contentImageUrl(url, { width: 200 })),
			...(tweet.external_tweet?.snapshot?.media ?? [])
				.filter((media) => media.kind === "photo")
				.map((media) => media.thumbnail_url || media.url),
		];
		for (const src of sources) {
			if (photos.length >= MAX_PHOTOS) break;
			if (!src || seen.has(src)) continue;
			seen.add(src);
			photos.push({ src, tweetId: tweet.id });
		}
	}

	return {
		topics: [...topicCounts]
			.map(([tag, count]) => ({ tag, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, MAX_TOPICS),
		authors: [...authorCounts.values()].sort((a, b) => b.count - a.count).slice(0, MAX_AUTHORS),
		photos,
	};
}
