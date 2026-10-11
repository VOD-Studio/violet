import { useSharedTweet } from "@entities/tweet/api/queries";
import { SharedTweetSummary } from "./SharedTweetSummary";

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
		<div className="rounded-xl border border-border bg-card p-3">
			<SharedTweetSummary tweet={tweet} />
			{tweet.quote_of && !tweet.quoted_tweet && (
				<p className="mt-2 text-xs text-muted-foreground">被引用的本站推文已删除</p>
			)}
		</div>
	);
}
