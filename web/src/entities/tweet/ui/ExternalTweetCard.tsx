import { ImagePreview, useImagePreview } from "@shared/ui/image-preview";
import {
	EmbeddedTweet,
	type TweetData,
	type TweetMedia,
	type TweetPhoto,
	type TweetSegment,
} from "@violetjs/react-tweet";
import type { ExternalTweet } from "../model/types";

/** 原文状态由本站服务端决定，不向外站重新加载被撤回或不可用的内容。 */
export interface ExternalTweetCardProps {
	/** 本站服务端返回的原文状态与已保存快照。 */
	tweet: ExternalTweet;
	/**
	 * 使用适合嵌套引用的紧凑间距。
	 *
	 * @default false
	 */
	compact?: boolean;
	/**
	 * 渲染为引用小卡片，用于嵌进聊天等别的内容里。
	 *
	 * @default false
	 */
	quoted?: boolean;
}

export function ExternalTweetCard({
	tweet,
	compact = false,
	quoted = false,
}: ExternalTweetCardProps) {
	const preview = useImagePreview();
	return (
		<>
			<EmbeddedTweet
				tweet={toEmbeddedTweet(tweet)}
				locale="zh-CN"
				timeZone="Asia/Shanghai"
				compact={compact}
				quoted={quoted}
				onOpenPhoto={(photos, index, trigger) =>
					openPhoto(preview.openPreview, photos, index, trigger)
				}
			/>
			<ImagePreview
				open={preview.open}
				images={preview.images}
				thumbnails={preview.thumbnails}
				currentIndex={preview.currentIndex}
				triggerElement={preview.triggerElement}
				onClose={preview.closePreview}
				onIndexChange={preview.setCurrentIndex}
			/>
		</>
	);
}

/** video.twimg.com 拒绝站外 Referer，播放统一经本站代理。 */
function externalVideoUrl(id: string, index: number) {
	return `/api/v1/tweets/external/${encodeURIComponent(id)}/media/${index}/video`;
}

function toEmbeddedTweet(tweet: ExternalTweet, nested = false): TweetData {
	if (tweet.availability !== "available" || !tweet.snapshot) {
		return {
			id: tweet.source_id,
			url: tweet.canonical_url,
			availability: tweet.availability === "available" ? "unavailable" : tweet.availability,
		};
	}

	const snapshot = tweet.snapshot;
	return {
		id: tweet.source_id,
		url: tweet.canonical_url,
		availability: "available",
		snapshot: {
			author: {
				name: snapshot.author.name,
				handle: snapshot.author.handle,
				url: snapshot.author.url,
				avatarUrl: snapshot.author.avatar_url,
				verification: snapshot.author.verified ? "individual" : undefined,
			},
			text: snapshot.text,
			segments: snapshot.segments?.map(
				(segment): TweetSegment =>
					segment.kind !== "text" && segment.url
						? { kind: segment.kind, text: segment.text, url: segment.url }
						: { kind: "text", text: segment.text },
			),
			publishedAt: snapshot.published_at,
			media: snapshot.media?.map((media, index): TweetMedia => {
				const metadata = { width: media.width, height: media.height, alt: media.alt };
				if (media.kind === "photo") {
					return {
						...metadata,
						kind: "photo",
						url: media.url,
						thumbnailUrl: media.thumbnail_url ? media.thumbnail_url : media.url,
					};
				}
				// 视频封面按卡片尺寸铺满，用原图而不是小缩略图。
				return {
					...metadata,
					kind: media.kind,
					thumbnailUrl: media.url,
					url: media.video_url ? externalVideoUrl(tweet.id, index) : undefined,
				};
			}),
			quoteUrl: snapshot.quote_url ?? tweet.quoted_tweet?.canonical_url,
			warnings: snapshot.warnings,
		},
		quotedTweet:
			!nested && tweet.quoted_tweet ? toEmbeddedTweet(tweet.quoted_tweet, true) : undefined,
	};
}

/** 图片布局由推文包决定（竖图为主时是横向滚动条），点击统一交给本站灯箱。 */
function openPhoto(
	openPreview: ReturnType<typeof useImagePreview>["openPreview"],
	photos: TweetPhoto[],
	index: number,
	trigger: HTMLElement,
) {
	const thumbnails = photos.map((photo) => photo.thumbnailUrl);
	// 缩略图与原图一一对应才传给预览：飞入占位与底部导航条不必拉取原图。
	openPreview(
		photos.map((photo) => photo.url),
		index,
		trigger,
		thumbnails.every((url): url is string => !!url) ? thumbnails : undefined,
	);
}
