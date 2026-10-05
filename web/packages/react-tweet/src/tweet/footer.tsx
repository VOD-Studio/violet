import type { TweetSnapshot } from "../data/types.ts";
import { parseTweetId } from "../data/urls.ts";
import { formatMessage, type TweetLocalization } from "./localization.ts";
import { TweetDate, TweetLink } from "./primitives.tsx";

export function TweetFooter({
	snapshot,
	id,
	source,
	localization: { messages, number, date },
}: {
	snapshot: TweetSnapshot;
	id?: string;
	source?: string;
	localization: TweetLocalization;
}) {
	const metrics = (["likes", "replies", "reposts"] as const).flatMap((kind) => {
		const count = snapshot.metrics?.[kind];
		return typeof count === "number" && Number.isFinite(count) && count >= 0
			? [{ kind, value: number.format(count) }]
			: [];
	});
	const tweetId = parseTweetId(id ?? "") ?? parseTweetId(source ?? "");
	if (!snapshot.publishedAt && metrics.length === 0) return null;
	return (
		<footer className="v-tweet__footer">
			{metrics.length > 0 && (
				<div className="v-tweet__metrics">
					{metrics.map(({ kind, value }) => (
						<TweetLink
							key={kind}
							className={`v-tweet__metric v-tweet__metric--${kind}`}
							href={
								tweetId && kind === "likes"
									? `https://twitter.com/intent/like?tweet_id=${tweetId}`
									: tweetId && kind === "replies"
										? `https://twitter.com/intent/tweet?in_reply_to=${tweetId}`
										: undefined
							}
							label={
								tweetId && kind !== "reposts"
									? `${kind === "likes" ? messages.likeAction : messages.replyAction}. ${formatMessage(messages[kind], "count", value)}`
									: undefined
							}
						>
							<span
								className="v-tweet__icon v-tweet__metric-icon"
								aria-hidden="true"
							/>
							<span aria-hidden="true">{value}</span>
							<span className="v-tweet__sr-only">
								{formatMessage(messages[kind], "count", value)}
							</span>
						</TweetLink>
					))}
				</div>
			)}
			{snapshot.publishedAt && (
				<TweetLink href={source} className="v-tweet__date">
					<TweetDate value={snapshot.publishedAt} formatter={date} />
				</TweetLink>
			)}
		</footer>
	);
}
