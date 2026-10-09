"use client";

import type { ComponentPropsWithRef } from "react";
import { useMemo } from "react";

import type { TweetFetcher } from "../data/fetcher.ts";
import { canonicalUrl, parseTweetId } from "../data/urls.ts";
import { EmbeddedTweet } from "./embedded-tweet.tsx";
import type { TweetDisplayOptions } from "./localization.ts";
import { resolveLocalization } from "./localization.ts";
import type { TweetMediaRenderers } from "./media-renderers.ts";
import { stopInteraction, TweetLink } from "./primitives.tsx";
import { useTweet } from "./use-tweet.ts";

/**
 * 异步推文组件属性。
 *
 * 保留原生 article 的属性与事件；id 专用于来源标识，正文内容由组件管理。
 */
export interface TweetProps
	extends Omit<ComponentPropsWithRef<"article">, "children" | "dangerouslySetInnerHTML" | "id">,
		TweetDisplayOptions,
		TweetMediaRenderers {
	/**
	 * 十进制推文标识或规范 X/Twitter 原文地址。
	 * @example "20"
	 */
	id: string;
	/**
	 * 由宿主提供的异步数据获取边界。
	 *
	 * getTweet 需在服务端调用；浏览器通过同源接口取得完整正文与作者元数据。
	 */
	fetcher: TweetFetcher;
}

/**
 * 挂载时加载推文，提供可访问的加载状态与手动重试。
 *
 * 标识或加载器变化会取消旧请求并立即隐藏旧内容；不会自动重试私密或不可用结果。
 * @param props - 来源标识、加载器、本地化及原生 article 属性。
 * @returns 加载状态、错误状态或原生快照文章。
 */
export function Tweet({
	id,
	fetcher,
	maxTextLines,
	locale,
	timeZone,
	messages,
	renderPhotos,
	renderVideo,
	onOpenPhoto,
	...articleProps
}: TweetProps) {
	const { result, retry } = useTweet(id, fetcher);
	const localization = useMemo(
		() => resolveLocalization({ locale, timeZone, messages }),
		[locale, timeZone, messages],
	);
	if (result.status === "success")
		return (
			<EmbeddedTweet
				{...articleProps}
				tweet={result.tweet}
				maxTextLines={maxTextLines}
				locale={locale}
				timeZone={timeZone}
				messages={messages}
				renderPhotos={renderPhotos}
				renderVideo={renderVideo}
				onOpenPhoto={onOpenPhoto}
			/>
		);
	const labels = localization.messages;
	const parsedId = parseTweetId(id);
	const loading = result.status === "loading";
	return (
		<article
			{...articleProps}
			className={`not-prose v-tweet v-tweet--status${articleProps.className ? ` ${articleProps.className}` : ""}`}
			aria-label={articleProps["aria-label"] ?? labels.tweetLabel}
			aria-busy={loading}
			data-state={result.status}
		>
			<p className={loading ? "v-tweet__sr-only" : "v-tweet__notice"} role="status">
				{loading ? labels.loading : labels.error}
			</p>
			{loading ? (
				<div className="v-tweet__skeleton" aria-hidden="true">
					<div className="v-tweet__skeleton-header">
						<span className="v-tweet__skeleton-avatar" />
						<div className="v-tweet__skeleton-author">
							<span />
							<span />
						</div>
						<span className="v-tweet__skeleton-brand" />
					</div>
					<div className="v-tweet__skeleton-body">
						<span />
						<span />
						<span />
					</div>
					<div className="v-tweet__skeleton-footer">
						<span />
						<span />
						<span />
						<span />
					</div>
				</div>
			) : (
				<div className="v-tweet__status-actions">
					<TweetLink
						href={parsedId ? canonicalUrl(parsedId) : undefined}
						className="v-tweet__source"
					>
						{labels.source}
					</TweetLink>
					<button
						type="button"
						className="v-tweet__retry"
						onClick={(event) => {
							stopInteraction(event);
							retry();
						}}
						onKeyDown={stopInteraction}
						onPointerDown={stopInteraction}
					>
						{labels.retry}
					</button>
				</div>
			)}
		</article>
	);
}
