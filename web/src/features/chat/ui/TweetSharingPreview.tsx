import type { Tweet } from "@entities/tweet/model/types";
import { ApiError } from "@shared/api/error";
import { formatDateTime, formatRelativeTime } from "@shared/lib/date";
import { avatarUrl, contentImageUrl } from "@shared/lib/image-url";
import { TWEET_MESSAGES } from "@shared/lib/tweet-messages";
import type { UseQueryResult } from "@tanstack/react-query";
import { QuoteCard } from "@violet/ui";

/** 用分享动作的同一份实时查询展示推文，不为预览再读取一份。 */
export function TweetSharingPreview({
	query,
}: {
	query: Pick<UseQueryResult<Tweet>, "data" | "error" | "isError" | "isFetching" | "isPending">;
}) {
	if (query.isPending || query.isFetching)
		return (
			<p role="status" className="text-xs text-muted-foreground">
				正在读取推文…
			</p>
		);
	if (query.isError && query.error instanceof ApiError && query.error.status === 404) {
		return <QuoteCard deleted />;
	}
	if (query.isError)
		return (
			<p role="alert" className="text-xs text-muted-foreground">
				推文暂不可用，请关闭后重试。
			</p>
		);
	const tweet = query.data;
	if (!tweet) return null;
	const external = tweet.external_tweet;
	const snapshot = external?.availability === "available" ? external.snapshot : undefined;
	const thumbnail =
		tweet.images[0]?.url || snapshot?.media?.[0]?.thumbnail_url || snapshot?.media?.[0]?.url;
	return (
		<QuoteCard
			authorName={tweet.author.username}
			authorAvatar={avatarUrl(tweet.author.avatar_url, tweet.author.username)}
			time={formatRelativeTime(new Date(tweet.created_at))}
			timeTitle={formatDateTime(tweet.created_at, "long")}
			content={tweet.content || snapshot?.text}
			imageSrc={thumbnail ? contentImageUrl(thumbnail, { width: 128 }) : undefined}
			nested={
				tweet.quoted_tweet || tweet.quote_of || tweet.external_tweet
					? TWEET_MESSAGES.quoteNested
					: undefined
			}
		/>
	);
}
