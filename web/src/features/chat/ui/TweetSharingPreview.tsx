import { useSharedTweet } from "@entities/tweet/api/queries";
import { ExternalTweetCard } from "@entities/tweet/ui/ExternalTweetCard";
import { contentImageUrl } from "@shared/lib/image-url";

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
	return (
		<div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-border bg-card p-3">
			<p className="text-xs font-medium text-foreground">@{tweet.author.username}</p>
			{tweet.content && (
				<p className="whitespace-pre-wrap wrap-break-word text-sm text-foreground">
					{tweet.content}
				</p>
			)}
			{tweet.images?.[0] && (
				<img
					src={contentImageUrl(tweet.images[0], { width: 300 })}
					alt="分享的推文图片"
					className="max-h-32 rounded-lg object-contain"
				/>
			)}
			{tweet.external_tweet && <ExternalTweetCard tweet={tweet.external_tweet} compact />}
			{tweet.quoted_tweet && (
				<div className="space-y-2 rounded-lg border border-border p-2">
					<p className="text-xs text-muted-foreground">
						引用 @{tweet.quoted_tweet.author.username}
					</p>
					{tweet.quoted_tweet.content && (
						<p className="whitespace-pre-wrap text-xs">{tweet.quoted_tweet.content}</p>
					)}
					{tweet.quoted_tweet.images?.[0] && (
						<img
							src={contentImageUrl(tweet.quoted_tweet.images[0], { width: 300 })}
							alt="被引用的推文图片"
							className="max-h-32 rounded-lg object-contain"
						/>
					)}
					{tweet.quoted_tweet.external_tweet && (
						<ExternalTweetCard tweet={tweet.quoted_tweet.external_tweet} compact />
					)}
				</div>
			)}
			{tweet.quote_of && !tweet.quoted_tweet && (
				<p className="text-xs text-muted-foreground">被引用的本站推文已删除</p>
			)}
		</div>
	);
}
