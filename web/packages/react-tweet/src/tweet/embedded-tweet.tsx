"use client";

import type { ComponentPropsWithRef } from "react";
import { useMemo } from "react";

import type { TweetData, TweetNotice } from "../data/types.ts";
import { safeUrl, tweetUrl } from "../data/urls.ts";
import { TweetCard } from "./card.tsx";
import { TweetFooter } from "./footer.tsx";
import { TweetHeader } from "./header.tsx";
import type { TweetDisplayOptions, TweetLocalization, TweetMessages } from "./localization.ts";
import { resolveLocalization } from "./localization.ts";
import { TweetMediaContent } from "./media.tsx";
import type { TweetMediaRenderers } from "./media-renderers.ts";
import { TweetLink } from "./primitives.tsx";
import { TweetText } from "./text.tsx";

/**
 * 原生推文快照的展示属性。
 *
 * 继承 article 的 style、ref、aria/data 属性及事件；正文内容由组件管理。
 */
export interface EmbeddedTweetProps
	extends Omit<ComponentPropsWithRef<"article">, "children" | "dangerouslySetInnerHTML">,
		TweetDisplayOptions,
		TweetMediaRenderers {
	/**
	 * 要展示的快照或明确的不可用状态。
	 *
	 * 组件不会主动获取正文，也不会重试不可用内容。
	 */
	tweet: TweetData;
	/**
	 * 使用紧凑间距，不改变正文或事件语义。
	 * @default false
	 */
	compact?: boolean;
}

const noticeMessages: Record<TweetNotice, keyof TweetMessages> = {
	poll: "poll",
	article: "article",
	truncated: "incompleteText",
	"unsupported-media": "unsupportedMedia",
	"media-unavailable": "unavailableMedia",
};

/**
 * 使用原生 HTML 展示快照，不抓取推文数据或加载第三方脚本、iframe。
 *
 * 正文点击保留冒泡；链接和媒体交互只阻止真实 DOM 后代的事件。
 * 图片与视频仍按快照地址加载。
 * @param props - 快照、显式本地化配置、媒体扩展点及原生 article 属性。
 * @returns 原生推文文章结构。
 */
export function EmbeddedTweet({
	tweet,
	compact = false,
	maxTextLines,
	locale,
	timeZone,
	messages,
	renderPhotos,
	renderVideo,
	...articleProps
}: EmbeddedTweetProps) {
	const localization = useMemo(
		() => resolveLocalization({ locale, timeZone, messages }),
		[locale, timeZone, messages],
	);
	return (
		<TweetContent
			tweet={tweet}
			compact={compact}
			maxTextLines={maxTextLines}
			localization={localization}
			renderPhotos={renderPhotos}
			renderVideo={renderVideo}
			articleProps={articleProps}
			depth={0}
		/>
	);
}

function TweetContent({
	tweet,
	compact,
	maxTextLines,
	localization,
	renderPhotos,
	renderVideo,
	articleProps,
	depth,
}: TweetMediaRenderers & {
	tweet: TweetData;
	compact: boolean;
	maxTextLines?: number;
	localization: TweetLocalization;
	articleProps?: Omit<ComponentPropsWithRef<"article">, "children" | "dangerouslySetInnerHTML">;
	depth: number;
}) {
	const { messages } = localization;
	const source = tweetUrl(tweet.url, tweet.id);
	const label = articleProps?.["aria-label"] ?? messages.tweetLabel;
	const unavailableState =
		tweet.availability === "available" ? "unavailable" : tweet.availability;
	if (tweet.availability !== "available" || !tweet.snapshot) {
		return (
			<TweetCard
				{...articleProps}
				compact={compact}
				isQuoted={depth > 0}
				aria-label={label}
				data-state={unavailableState}
				contentSlot={<p className="v-tweet__notice">{messages[unavailableState]}</p>}
				footerSlot={
					<TweetLink href={source} className="v-tweet__source">
						{messages.source}
					</TweetLink>
				}
			/>
		);
	}
	const { snapshot } = tweet;
	const quoteSource = tweet.quotedTweet
		? tweetUrl(tweet.quotedTweet.url, tweet.quotedTweet.id)
		: safeUrl(snapshot.quoteUrl);
	const warnings = [
		...(snapshot.notices ?? [])
			.map((notice) => messages[noticeMessages[notice]])
			.filter(Boolean),
		...(snapshot.warnings ?? []),
	];
	return (
		<TweetCard
			{...articleProps}
			compact={compact}
			isQuoted={depth > 0}
			aria-label={label}
			data-state="available"
			headerSlot={
				<TweetHeader author={snapshot.author} source={source} messages={messages} />
			}
			contentSlot={
				(snapshot.text || !!snapshot.segments?.length) && (
					<TweetText
						key={`${source ?? ""}:${maxTextLines ?? ""}`}
						text={snapshot.text}
						segments={snapshot.segments}
						maxTextLines={maxTextLines}
						messages={messages}
					/>
				)
			}
			mediaSlot={
				!!snapshot.media?.length && (
					<TweetMediaContent
						media={snapshot.media}
						source={source}
						renderPhotos={renderPhotos}
						renderVideo={renderVideo}
						localization={localization}
					/>
				)
			}
			quoteSlot={
				tweet.quotedTweet && depth === 0 ? (
					<TweetContent
						tweet={tweet.quotedTweet}
						compact
						renderPhotos={renderPhotos}
						renderVideo={renderVideo}
						localization={localization}
						depth={1}
					/>
				) : (
					quoteSource && (
						<TweetLink href={quoteSource} className="v-tweet__quote-link">
							{messages.quote}
						</TweetLink>
					)
				)
			}
			footerSlot={
				<>
					{warnings.length > 0 && (
						<ul className="v-tweet__warnings">
							{warnings.map((warning, index) => (
								<li key={`${index}:${warning}`}>{warning}</li>
							))}
						</ul>
					)}
					<TweetFooter
						snapshot={snapshot}
						id={tweet.id}
						source={source}
						localization={localization}
					/>
				</>
			}
		/>
	);
}
