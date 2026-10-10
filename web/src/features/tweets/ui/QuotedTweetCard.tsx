import type { QuotedTweet } from "@entities/tweet/model/types";
import { ExternalTweetCard } from "@entities/tweet/ui/ExternalTweetCard";
import { NoSharedElements } from "@shared/lib/view-transition";
import { useNavigate } from "@tanstack/react-router";
import { TweetCard } from "@violet/react-tweet";
import { TweetCardHeader } from "./TweetCardHeader";
import { TweetCardImages } from "./TweetCardImages";
import TweetContent from "./TweetContent";

/** 使用共享推文卡片展示本站引用，外部快照继续走独立渲染链。 */
export function QuotedTweetCard({ tweet }: { tweet: QuotedTweet }) {
	const navigate = useNavigate();
	const openDetail = () => navigate({ to: "/tweets/$id", params: { id: tweet.id } });

	return (
		<TweetCard
			compact
			isQuoted
			aria-label={`${tweet.author.username} 的引用推文`}
			tabIndex={0}
			className="cursor-pointer"
			onClick={(event) => {
				if (!event.currentTarget.contains(event.target as Node)) return;
				event.stopPropagation();
				openDetail();
			}}
			onKeyDown={(event) => {
				if (
					event.target === event.currentTarget &&
					(event.key === "Enter" || event.key === " ")
				) {
					event.preventDefault();
					event.stopPropagation();
					openDetail();
				}
			}}
			headerSlot={
				// 同一条被引用的推文可能出现在多张卡片里，嵌套的头像不参与共享元素转场。
				<NoSharedElements>
					<TweetCardHeader
						author={tweet.author}
						tweetId={tweet.id}
						createdAt={tweet.created_at}
					/>
				</NoSharedElements>
			}
			contentSlot={
				<TweetContent
					content={tweet.content}
					emote={tweet.emote}
					className="line-clamp-3 text-sm leading-relaxed"
				/>
			}
			mediaSlot={<TweetCardImages images={tweet.images} />}
			quoteSlot={
				tweet.external_tweet && <ExternalTweetCard tweet={tweet.external_tweet} compact />
			}
		/>
	);
}
