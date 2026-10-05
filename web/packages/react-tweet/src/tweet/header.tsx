import type { TweetAuthor } from "../data/author.js";
import { safeUrl } from "../data/urls.js";
import type { TweetMessages } from "./localization.js";
import { TweetImage, TweetLink } from "./primitives.js";
import { VerifiedBadge } from "./verified-badge.js";

export function TweetHeader({
	author,
	source,
	messages,
}: {
	author: TweetAuthor;
	source?: string;
	messages: TweetMessages;
}) {
	const handle = author.handle.replace(/^@/, "");
	const name = author.name || handle;
	const authorUrl =
		safeUrl(author.url) ??
		(/^[A-Za-z0-9_]{1,15}$/.test(handle) ? `https://x.com/${handle}` : undefined);
	const affiliation = author.affiliation;
	const affiliationName = affiliation?.name || messages.affiliation;
	return (
		<header className="v-tweet__header">
			<div className="v-tweet__identity">
				<TweetLink href={authorUrl} className="v-tweet__avatar-link" label={name}>
					<TweetImage
						src={author.avatarUrl}
						alt=""
						className="v-tweet__avatar"
						width={40}
						height={40}
						fallback={<span aria-hidden="true">{Array.from(name || "X")[0]}</span>}
					/>
				</TweetLink>
				<div className="v-tweet__author">
					<div className="v-tweet__name-row">
						<TweetLink href={authorUrl} className="v-tweet__name">
							{name}
						</TweetLink>
						{author.verification && (
							<VerifiedBadge kind={author.verification} messages={messages} />
						)}
						{affiliation && safeUrl(affiliation.imageUrl) && (
							<span className="v-tweet__affiliation" title={affiliationName}>
								<TweetLink href={affiliation.url} label={affiliationName}>
									<TweetImage
										src={affiliation.imageUrl}
										alt={affiliationName}
										width={16}
										height={16}
										fallback={
											<span className="v-tweet__sr-only">
												{affiliationName}
											</span>
										}
									/>
								</TweetLink>
							</span>
						)}
					</div>
					<TweetLink href={authorUrl} className="v-tweet__handle">
						@{handle}
					</TweetLink>
				</div>
			</div>
			<TweetLink href={source} className="v-tweet__brand" label={messages.source}>
				<svg
					aria-hidden="true"
					viewBox="0 0 24 24"
					width="20"
					height="20"
					fill="currentColor"
				>
					<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817-5.966 6.817H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117Z" />
				</svg>
			</TweetLink>
		</header>
	);
}
