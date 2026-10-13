"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";

import type { TweetMedia, TweetPhoto, TweetVideo } from "../data/media.ts";
import { safeUrl } from "../data/urls.ts";
import type { TweetLocalization } from "./localization.ts";
import type { TweetMediaRenderers } from "./media-renderers.ts";
import { MediaRail, ratioOf, TweetPhotos, TweetThumbnails } from "./photos.tsx";
import { stopInteraction, TweetImage, TweetLink } from "./primitives.tsx";

function reducedMotion(): boolean {
	return (
		typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches
	);
}

/** 可见比例达到该值才算「在看」，与滚动条吸附后露出的相邻卡片区分开。 */
const GIF_VISIBLE_RATIO = 0.6;

function playQuietly(video: HTMLVideoElement) {
	// play() 被自动播放策略拒绝时静默；jsdom 等环境可能不返回 Promise。
	Promise.resolve(video.play()).catch(() => undefined);
}

/**
 * 同一滚动条内只播放可见度最高的动图，并列时取靠前的一张；不在滚动条里的动图各自判断。
 *
 * 当前那张被用户手动暂停时保持暂停，不顺延到下一张。
 */
function syncGifs(element: HTMLVideoElement) {
	const scope = element.closest(".v-tweet__rail-track");
	const videos = scope
		? Array.from(scope.querySelectorAll<HTMLVideoElement>('video[data-kind="animated_gif"]'))
		: [element];
	let current: HTMLVideoElement | undefined;
	let best = GIF_VISIBLE_RATIO;
	for (const video of videos) {
		const ratio = Number(video.dataset.visibleRatio ?? 0);
		// 0.01 容差：阈值回调的比例略有抖动，不让后面的卡片因误差抢走播放。
		if (ratio >= best && (!current || ratio > best + 0.01)) {
			current = video;
			best = ratio;
		}
	}
	for (const video of videos) {
		if (video === current && video.dataset.manual !== "true" && !reducedMotion())
			playQuietly(video);
		else if (video !== current) video.pause();
	}
}

/** 已知宽高时预留媒体比例，封面与视频原始尺寸不同也不会在加载后跳变。 */
function sizing(media: TweetVideo): { style?: CSSProperties; "data-sized"?: "" } {
	if (!media.width || !media.height) return {};
	return {
		style: { "--_media-ratio": media.width / media.height } as CSSProperties,
		"data-sized": "",
	};
}

function durationOf(video: HTMLVideoElement): number | undefined {
	return Number.isFinite(video.duration) && video.duration > 0 ? video.duration : undefined;
}

function formatDuration(seconds: number): string {
	const total = Math.round(seconds);
	return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * 动图：进入视口超过六成时自动播放，移出即暂停；滚动条里只播放可见度最高的那张。
 * 用户手动暂停后，再次进入视口不会强行恢复；偏好减少动态时不自动播放。
 */
function TweetGif({
	media,
	url,
	label,
	onError,
}: {
	media: TweetVideo;
	url: string;
	label: string;
	onError: () => void;
}) {
	const video = useRef<HTMLVideoElement>(null);
	const [playing, setPlaying] = useState(false);
	useEffect(() => {
		const element = video.current;
		if (!element || typeof IntersectionObserver === "undefined") return;
		const observer = new IntersectionObserver(
			([entry]) => {
				element.dataset.visibleRatio = String(entry.intersectionRatio);
				syncGifs(element);
			},
			{ threshold: [0, 0.2, 0.4, GIF_VISIBLE_RATIO, 0.7, 0.8, 0.9, 1] },
		);
		observer.observe(element);
		return () => observer.disconnect();
	}, []);
	const toggle = () => {
		const element = video.current;
		if (!element) return;
		element.dataset.manual = String(!element.paused);
		if (element.paused) playQuietly(element);
		else element.pause();
	};
	return (
		<div className="v-tweet__gif" {...sizing(media)}>
			<video
				ref={video}
				className="v-tweet__video"
				data-kind="animated_gif"
				src={url}
				poster={media.thumbnailUrl}
				playsInline
				preload="auto"
				muted
				loop
				// 动图没有原生控件，需可聚焦才能用键盘暂停。
				tabIndex={0}
				aria-label={label}
				onPlay={() => setPlaying(true)}
				onPause={() => setPlaying(false)}
				onClick={(event) => {
					stopInteraction(event);
					toggle();
				}}
				onKeyDown={(event) => {
					stopInteraction(event);
					if (event.key === " " || event.key === "Enter") {
						event.preventDefault();
						toggle();
					}
				}}
				onPointerDown={stopInteraction}
				onError={onError}
			/>
			<span className="v-tweet__gif-badge" data-playing={playing} aria-hidden="true">
				<svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
					{playing ? (
						<path d="M2.5 1.5h2.5v9H2.5zM7 1.5h2.5v9H7z" />
					) : (
						<path d="M3 1.5l7 4.5-7 4.5z" />
					)}
				</svg>
				GIF
			</span>
		</div>
	);
}

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
	const isGif = media.kind === "animated_gif";
	if (!media.url || failedUrl === media.url) {
		return (
			<div className="v-tweet__video-fallback" {...sizing(media)}>
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
	const label = media.alt ?? (isGif ? messages.animation : messages.video);
	const fail = () => setFailedUrl(media.url);
	if (isGif) return <TweetGif media={media} url={media.url} label={label} onError={fail} />;
	return (
		<TweetPlayer
			media={media}
			url={media.url}
			label={label}
			source={source}
			localization={localization}
			onError={fail}
		/>
	);
}

/**
 * 普通视频：播放前只显示封面、播放按钮与时长，点击后才出现原生控件并开始播放。
 */
function TweetPlayer({
	media,
	url,
	label,
	source,
	localization: { messages },
	onError,
}: {
	media: TweetVideo;
	url: string;
	label: string;
	source?: string;
	localization: TweetLocalization;
	onError: () => void;
}) {
	const video = useRef<HTMLVideoElement>(null);
	const [started, setStarted] = useState(false);
	const [duration, setDuration] = useState<number>();
	useEffect(() => {
		// SSR 页面里元数据可能在水合前就已加载，loadedmetadata 事件不会再触发。
		const element = video.current;
		if (element && element.readyState >= HTMLMediaElement.HAVE_METADATA)
			setDuration(durationOf(element));
	}, []);
	const start = () => {
		const element = video.current;
		setStarted(true);
		if (!element) return;
		element.focus();
		playQuietly(element);
	};
	return (
		<div className="v-tweet__player" data-started={started} {...sizing(media)}>
			{/* biome-ignore lint/a11y/useMediaCaption: 推文视频来源不提供字幕轨道。 */}
			<video
				ref={video}
				className="v-tweet__video"
				data-kind={media.kind}
				src={url}
				poster={media.thumbnailUrl}
				controls={started}
				playsInline
				preload="metadata"
				tabIndex={started ? 0 : -1}
				aria-label={label}
				onLoadedMetadata={(event) => setDuration(durationOf(event.currentTarget))}
				onClick={stopInteraction}
				onKeyDown={stopInteraction}
				onPointerDown={stopInteraction}
				onError={onError}
			>
				<TweetLink href={source}>{messages.viewVideo}</TweetLink>
			</video>
			{!started && (
				<button
					type="button"
					className="v-tweet__play-button"
					aria-label={`${messages.playVideo}: ${label}`}
					onClick={(event) => {
						stopInteraction(event);
						start();
					}}
					onKeyDown={stopInteraction}
					onPointerDown={stopInteraction}
				>
					<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
						<path d="M8 5.5v13l11-6.5z" />
					</svg>
				</button>
			)}
			{!started && duration !== undefined && (
				<span className="v-tweet__duration" aria-hidden="true">
					{formatDuration(duration)}
				</span>
			)}
		</div>
	);
}

function VideoThumbnail({
	media,
	source,
	localization: { messages },
}: {
	media: TweetVideo;
	source?: string;
	localization: TweetLocalization;
}) {
	return (
		<TweetLink href={source} className="v-tweet__video-thumb" label={messages.viewVideo}>
			<TweetImage
				src={media.thumbnailUrl}
				alt={media.alt ?? messages.videoPoster}
				fallback={messages.videoPosterUnavailable}
			/>
			<span className="v-tweet__play" aria-hidden="true" />
		</TweetLink>
	);
}

interface TweetMediaContentProps extends TweetMediaRenderers {
	/** 引用卡片：照片用小缩略图，视频只显示封面并链接到来源。 */
	thumbnails?: boolean;
	/** 来源给出的有序媒体列表。 */
	media: TweetMedia[];
	/** 媒体不可播放时可访问的原文地址。 */
	source?: string;
	/** 与正文一致的文案和格式化器。 */
	localization: TweetLocalization;
}

type MediaGroup =
	| { kind: "photos"; photos: TweetPhoto[] }
	| { kind: "videos"; videos: TweetVideo[] };

export function TweetMediaContent({
	media,
	source,
	thumbnails,
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
		if (!url && !thumbnailUrl) {
			unavailable = true;
			continue;
		}
		const video = (
			url ? { ...item, url, thumbnailUrl } : { ...item, url: undefined, thumbnailUrl }
		) as TweetVideo;
		const previous = groups.at(-1);
		if (previous?.kind === "videos") previous.videos.push(video);
		else groups.push({ kind: "videos", videos: [video] });
	}
	return (
		<div className="v-tweet__media">
			{groups.map((group, groupIndex) =>
				group.kind === "photos" ? (
					<div key={`photos:${groupIndex}`} className="v-tweet__photo-group">
						{renderPhotos ? (
							renderPhotos(group.photos)
						) : thumbnails ? (
							<TweetThumbnails
								photos={group.photos}
								localization={localization}
								onOpenPhoto={onOpenPhoto}
							/>
						) : (
							<TweetPhotos
								photos={group.photos}
								localization={localization}
								onOpenPhoto={onOpenPhoto}
							/>
						)}
					</div>
				) : (
					<div key={`videos:${groupIndex}`} className="v-tweet__photo-group">
						{group.videos.length > 1 && !renderVideo && !thumbnails ? (
							<MediaRail count={group.videos.length} localization={localization}>
								{group.videos.map((video, index) => (
									<div
										key={`${video.url ?? video.thumbnailUrl}:${index}`}
										className="v-tweet__rail-item"
										style={
											{ "--_photo-ratio": ratioOf(video) } as CSSProperties
										}
									>
										<NativeTweetVideo
											media={video}
											source={source}
											localization={localization}
										/>
									</div>
								))}
							</MediaRail>
						) : (
							group.videos.map((video, index) => (
								<div key={`${video.url ?? video.thumbnailUrl}:${index}`}>
									{renderVideo ? (
										renderVideo(video)
									) : thumbnails && video.thumbnailUrl ? (
										<VideoThumbnail
											media={video}
											source={source}
											localization={localization}
										/>
									) : (
										<NativeTweetVideo
											media={video}
											source={source}
											localization={localization}
										/>
									)}
								</div>
							))
						)}
					</div>
				),
			)}
			{unavailable && <p className="v-tweet__notice">{messages.unavailableMedia}</p>}
		</div>
	);
}
