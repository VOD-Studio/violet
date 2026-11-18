import type { Tweet } from "@entities/tweet/model/types";
import { ExternalTweetCard } from "@entities/tweet/ui/ExternalTweetCard";
import { QuoteCard } from "@violet/ui";
import { QuotedTweetCard } from "./QuotedTweetCard";

/** 本站推文的转发来源，不展开下一层引用。 */
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
