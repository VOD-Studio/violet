import type { Tweet } from "@entities/tweet/model/types";
import { ExternalTweetCard } from "@entities/tweet/ui/ExternalTweetCard";
import { QuoteCard } from "@violet/ui";
import { QuotedTweetCard } from "./QuotedTweetCard";

/** 详情页分栏时左侧的转发来源：X 原文、被引用的本站推文，或被引用推文已删除的占位。 */
export function TweetDetailSources({ tweet }: { tweet: Tweet }) {
	if (!tweet.external_tweet && !tweet.quoted_tweet && !tweet.quote_of) return null;
	return (
		<div className="space-y-2">
			{tweet.external_tweet && <ExternalTweetCard tweet={tweet.external_tweet} />}
			{tweet.quoted_tweet && <QuotedTweetCard tweet={tweet.quoted_tweet} />}
			{tweet.quote_of && !tweet.quoted_tweet && <QuoteCard deleted />}
		</div>
	);
}
