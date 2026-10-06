import { fetchTweetReference } from "@shared/server/tweet-reference";
import { EmbeddedTweet, Tweet, type TweetData } from "@violet/react-tweet";

import type { TweetEmbedConfig } from "./types";
import { articleEmbedImageUrl } from "./url";

interface TweetEmbedCardProps {
	/** 已通过文章 schema 校验的引用或快照配置。 */
	config: TweetEmbedConfig;
}

/** 作者提供快照时不发外站请求；只有显式 ID 或 URL 引用才加载原文。 */
export function TweetEmbedCard({ config }: TweetEmbedCardProps) {
	if ("id" in config) {
		return (
			<Tweet
				id={config.id}
				fetcher={fetchTweetReference}
				maxTextLines={config.maxTextLines}
				locale="zh-CN"
				timeZone="Asia/Shanghai"
			/>
		);
	}

	const handle = config.handle.replace(/^@/u, "");
	const tweet: TweetData = {
		url: config.url,
		availability: "available",
		snapshot: {
			author: {
				name: config.author,
				handle,
				url: `https://x.com/${encodeURIComponent(handle)}`,
				avatarUrl: config.avatar ? articleEmbedImageUrl(config.avatar, 160) : undefined,
				verification: config.verified ? "individual" : undefined,
			},
			text: config.text,
			publishedAt: config.date,
			media: config.image
				? [
						{
							kind: "photo",
							url: articleEmbedImageUrl(config.image, 1200),
							alt: config.imageAlt,
						},
					]
				: undefined,
		},
	};

	return (
		<EmbeddedTweet
			tweet={tweet}
			maxTextLines={config.maxTextLines}
			locale="zh-CN"
			timeZone="Asia/Shanghai"
		/>
	);
}
