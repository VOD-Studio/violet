import type { TweetAuthor } from "../data/author.ts";
import { safeUrl } from "../data/urls.ts";
import type { TweetMessages } from "./localization.ts";
import { TweetImage, TweetLink } from "./primitives.tsx";

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
							<span
								className="v-tweet__icon v-tweet__verified"
								data-kind={author.verification}
								role="img"
								aria-label={
									author.verification === "business"
										? messages.verifiedBusiness
										: author.verification === "government"
											? messages.verifiedGovernment
											: messages.verified
								}
							/>
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
				<span className="v-tweet__icon v-tweet__brand-icon" aria-hidden="true" />
			</TweetLink>
		</header>
	);
}
