import { useSharedTweet } from "@entities/tweet/api/queries";
import { formatDateTime, formatRelativeTime } from "@shared/lib/date";
import { avatarUrl, contentImageUrl } from "@shared/lib/image-url";
import { TWEET_MESSAGES } from "@shared/lib/tweet-messages";
import { QuoteCard } from "@violet/ui";

/** 分享选择与待发送横条都读取当前推文，避免继续展示已撤回的来源。 */
export function TweetSharingPreview({ id }: { id: string }) {
	const query = useSharedTweet(id, true);
	if (query.isPending || query.isFetching)
		return (
			<p role="status" className="text-xs text-muted-foreground">
				正在读取推文…
			</p>
		);
	if (query.isError)
		return (
			<p role="alert" className="text-xs text-muted-foreground">
				推文暂不可用，请关闭后重试。
			</p>
		);
	const tweet = query.data;
	if (!tweet) return null;
	const thumbnail = tweet.images[0];
	return (
		<QuoteCard
			authorName={tweet.author.username}
			authorAvatar={avatarUrl(tweet.author.avatar_url, tweet.author.username)}
			time={formatRelativeTime(new Date(tweet.created_at))}
			timeTitle={formatDateTime(tweet.created_at, "long")}
			content={tweet.content}
			imageSrc={thumbnail ? contentImageUrl(thumbnail.url, { width: 128 }) : undefined}
			// 预览不导航；二级引用只留一行说明，被引用的推文删掉了就直接写明。
			nested={
				tweet.quoted_tweet
					? TWEET_MESSAGES.quoteNested
					: tweet.quote_of
						? "原推文已删除"
						: undefined
			}
		/>
	);
}
