import { formatDateTime, formatRelativeTime } from "@shared/lib/date";
import { avatarUrl, contentImageUrl } from "@shared/lib/image-url";
import { TWEET_MESSAGES } from "@shared/lib/tweet-messages";
import { Link } from "@tanstack/react-router";
import { QuoteCard } from "@violet/ui";
import type { SharedTweet } from "../model/types";

/** 聊天接口按本站推文 ID 读取的当前内容，删除时不展示历史原文。 */
export interface TweetShareCardProps {
	tweet: SharedTweet;
}

export function TweetShareCard({ tweet }: TweetShareCardProps) {
	if (tweet.is_deleted || !tweet.author) {
		return <QuoteCard deleted />;
	}

	const author = tweet.author;
	const thumbnail = tweet.images?.[0];

	return (
		<QuoteCard
			className="w-80 max-w-full"
			href={`/tweets/${tweet.id}`}
			label={`查看 ${author.username} 的这条推文`}
			authorName={author.username}
			authorAvatar={avatarUrl(author.avatar_url, author.username)}
			time={tweet.created_at ? formatRelativeTime(new Date(tweet.created_at)) : undefined}
			timeTitle={tweet.created_at ? formatDateTime(tweet.created_at, "long") : undefined}
			content={tweet.content}
			imageSrc={thumbnail ? contentImageUrl(thumbnail.url, { width: 128 }) : undefined}
			nested={
				tweet.quote_of || tweet.quoted_tweet || tweet.external_tweet
					? TWEET_MESSAGES.quoteNested
					: undefined
			}
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
