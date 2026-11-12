import type { QuotedTweet } from "@entities/tweet/model/types";
import { formatDateTime, formatRelativeTime } from "@shared/lib/date";
import { avatarUrl, contentImageUrl } from "@shared/lib/image-url";
import { TWEET_MESSAGES } from "@shared/lib/tweet-messages";
import { Link } from "@tanstack/react-router";
import { QuoteCard } from "@violet/ui";

/** 被引用的本站推文：整卡是去原文的链接，正文两行，最多一张缩略图。 */
export function QuotedTweetCard({ tweet }: { tweet: QuotedTweet }) {
	const thumbnail = tweet.images[0];
	return (
		<QuoteCard
			href={`/tweets/${tweet.id}`}
			label={`查看 ${tweet.author.username} 的这条推文`}
			authorName={tweet.author.username}
			authorAvatar={avatarUrl(tweet.author.avatar_url, tweet.author.username)}
			time={formatRelativeTime(new Date(tweet.created_at))}
			timeTitle={formatDateTime(tweet.created_at, "long")}
			content={tweet.content}
			imageSrc={thumbnail ? contentImageUrl(thumbnail.url, { width: 128 }) : undefined}
			nested={tweet.quote_of || tweet.external_tweet ? TWEET_MESSAGES.quoteNested : undefined}
			renderLink={({ className, children, ...linkProps }) => (
				<Link
					className={className}
					aria-label={linkProps["aria-label"]}
					params={{ id: tweet.id }}
					to="/tweets/$id"
				>
					{children}
				</Link>
			)}
		/>
	);
}
