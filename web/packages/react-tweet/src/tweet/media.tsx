"use client";

import { useState } from "react";

import type { TweetMedia, TweetPhoto, TweetVideo } from "../data/media.ts";
import { safeUrl } from "../data/urls.ts";
import type { TweetLocalization } from "./localization.ts";
import type { TweetMediaRenderers } from "./media-renderers.ts";
import { TweetPhotos } from "./photos.tsx";
import { stopInteraction, TweetImage, TweetLink } from "./primitives.tsx";

function NativeTweetVideo({
	media,
	source,
	localization,
}: {
	media: TweetVideo;
	source?: string;
	localization: TweetLocalization;
}) {
	const { messages } = localization;
	const [failedUrl, setFailedUrl] = useState<string>();
	if (!media.url || failedUrl === media.url) {
		return (
			<div className="v-tweet__video-fallback">
				<TweetLink href={source}>
					{media.thumbnailUrl && (
						<TweetImage
							src={media.thumbnailUrl}
							alt={media.alt ?? messages.videoPoster}
							fallback={messages.videoPosterUnavailable}
						/>
					)}
					<span className="v-tweet__media-link">{messages.viewVideo}</span>
				</TweetLink>
			</div>
		);
	}
	return (
		<video
			className="v-tweet__video"
			src={media.url}
			poster={media.thumbnailUrl}
			controls
			playsInline
			preload="none"
			muted={media.kind === "animated_gif"}
			loop={media.kind === "animated_gif"}
			aria-label={
				media.alt ?? (media.kind === "animated_gif" ? messages.animation : messages.video)
			}
			onClick={stopInteraction}
			onKeyDown={stopInteraction}
			onPointerDown={stopInteraction}
			onError={() => setFailedUrl(media.url)}
		>
			<TweetLink href={source}>{messages.viewVideo}</TweetLink>
		</video>
	);
}

interface TweetMediaContentProps extends TweetMediaRenderers {
	/** 来源给出的有序媒体列表。 */
	media: TweetMedia[];
	/** 媒体不可播放时可访问的原文地址。 */
	source?: string;
	/** 与正文一致的文案和格式化器。 */
	localization: TweetLocalization;
}

type MediaGroup = { kind: "photos"; photos: TweetPhoto[] } | { kind: "video"; video: TweetVideo };

export function TweetMediaContent({
	media,
	source,
	renderPhotos,
	renderVideo,
	onOpenPhoto,
	localization,
}: TweetMediaContentProps) {
	const { messages } = localization;
	const groups: MediaGroup[] = [];
	let unavailable = false;
	for (const item of media) {
		let url = safeUrl(item.url);
		const thumbnailUrl = safeUrl(item.thumbnailUrl);
		if (item.kind === "photo") {
			if (!url) {
				unavailable = true;
				continue;
			}
			const photo = { ...item, url, thumbnailUrl };
			const previous = groups.at(-1);
			if (previous?.kind === "photos") previous.photos.push(photo);
			else groups.push({ kind: "photos", photos: [photo] });
			continue;
		}
		if (url && (url === thumbnailUrl || /\.(?:jpe?g|png|webp|avif)(?:$|[?#])/i.test(url))) {
			url = undefined;
		}
		if (url) groups.push({ kind: "video", video: { ...item, url, thumbnailUrl } });
		else if (thumbnailUrl) {
			groups.push({ kind: "video", video: { ...item, url: undefined, thumbnailUrl } });
		} else unavailable = true;
	}
	return (
		<div className="v-tweet__media">
			{groups.map((group, groupIndex) =>
				group.kind === "photos" ? (
					<div key={`photos:${groupIndex}`} className="v-tweet__photo-group">
						{renderPhotos ? (
							renderPhotos(group.photos)
						) : (
							<TweetPhotos
								photos={group.photos}
								localization={localization}
								onOpenPhoto={onOpenPhoto}
							/>
						)}
					</div>
				) : (
					<div key={`video:${group.video.url ?? group.video.thumbnailUrl}:${groupIndex}`}>
						{renderVideo ? (
							renderVideo(group.video)
						) : (
							<NativeTweetVideo
								media={group.video}
								source={source}
								localization={localization}
							/>
						)}
					</div>
				),
			)}
			{unavailable && <p className="v-tweet__notice">{messages.unavailableMedia}</p>}
		</div>
	);
}
