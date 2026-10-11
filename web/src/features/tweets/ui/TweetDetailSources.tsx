import type { Tweet } from "@entities/tweet/model/types";
import { ExternalTweetCard } from "@entities/tweet/ui/ExternalTweetCard";
import { AlertCircle } from "lucide-react";
import { QuotedTweetCard } from "./QuotedTweetCard";

/** 详情页分栏时左侧的转发来源：X 原文、被引用的本站推文，或被引用推文已删除的占位。 */
export function TweetDetailSources({ tweet }: { tweet: Tweet }) {
	if (!tweet.external_tweet && !tweet.quoted_tweet && !tweet.quote_of) return null;
	return (
		<div className="space-y-2">
			{tweet.external_tweet && <ExternalTweetCard tweet={tweet.external_tweet} />}
			{tweet.quoted_tweet && <QuotedTweetCard tweet={tweet.quoted_tweet} />}
			{tweet.quote_of && !tweet.quoted_tweet && (
				<div className="flex items-center gap-2 rounded-xl border border-edge-hairline bg-muted/20 p-3 text-xs text-muted-foreground">
					<AlertCircle className="size-4 shrink-0" />
					<span>推文已删除</span>
				</div>
			)}
		</div>
	);
}
