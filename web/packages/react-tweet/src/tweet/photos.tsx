"use client";

import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { TweetMediaMetadata, TweetPhoto } from "../data/media.ts";
import type { TweetLocalization } from "./localization.ts";
import { formatMessage } from "./localization.ts";
import { TweetImage, TweetLink } from "./primitives.tsx";

type OpenPhoto = (photos: TweetPhoto[], index: number, trigger: HTMLElement) => void;

export interface TweetPhotosProps {
	/** 一组连续照片，保留来源顺序。 */
	photos: TweetPhoto[];
	localization: TweetLocalization;
	/** 接管照片的打开方式；缺省时在新页打开原图。 */
	onOpenPhoto?: OpenPhoto;
}

/** 卡片宽高比的钳制范围，避免极端长图或横幅撑出过窄或过宽的卡片。 */
const MIN_RATIO = 0.4;
const MAX_RATIO = 1.8;

export function ratioOf(photo: TweetMediaMetadata): number {
	if (!photo.width || !photo.height) return 1;
	return Math.min(MAX_RATIO, Math.max(MIN_RATIO, photo.width / photo.height));
}

/**
 * 竖图为主的照片组用横向滚动条展示，其余用方格。
 *
 * 缺少尺寸的照片无法判断方向，整组退回方格。
 */
function isPortraitSet(photos: TweetPhoto[]): boolean {
	if (photos.length < 2) return false;
	let portrait = 0;
	for (const photo of photos) {
		if (!photo.width || !photo.height) return false;
		if (photo.height > photo.width) portrait++;
	}
	return portrait * 2 > photos.length;
}

function PhotoLink({
	photos,
	index,
	localization,
	onOpenPhoto,
	style,
	hiddenCount = 0,
}: TweetPhotosProps & {
	index: number;
	style?: CSSProperties;
	/** 折叠在这一格之后的照片数量，大于 0 时显示「+N」。 */
	hiddenCount?: number;
}) {
	const { messages, number } = localization;
	const photo = photos[index];
	const activate = onOpenPhoto
		? (event: MouseEvent<HTMLAnchorElement>) => {
			// 修饰键与非主键点击保留链接的原生行为。
			if (
				event.defaultPrevented ||
				event.button !== 0 ||
				event.metaKey ||
				event.ctrlKey ||
				event.shiftKey ||
				event.altKey
			)
				return;
			event.preventDefault();
			onOpenPhoto(photos, index, event.currentTarget);
		}
		: undefined;
	return (
		<TweetLink
			href={photo.url}
			className="v-tweet__photo"
			label={formatMessage(messages.viewPhoto, "index", number.format(index + 1))}
			style={style}
			onActivate={activate}
		>
			<TweetImage
				src={photo.thumbnailUrl ?? photo.url}
				alt={photo.alt ?? formatMessage(messages.photo, "index", number.format(index + 1))}
				width={photo.width}
				height={photo.height}
				fallback={photo.alt ?? messages.imageUnavailable}
			/>
			{hiddenCount > 0 && (
				<span className="v-tweet__more" aria-hidden="true">
					+{number.format(hiddenCount)}
				</span>
			)}
		</TweetLink>
	);
}

/**
 * 同高卡片的横向滚动条，边缘按钮与键盘滚动由本组件负责，卡片内容由 children 提供。
 *
 * 子元素需带 `v-tweet__rail-item` 类，并可用 `--_photo-ratio` 指定宽高比。
 */
export function MediaRail({
	count,
	localization,
	children,
}: {
	/** 卡片数量，用于无障碍标签。 */
	count: number;
	localization: TweetLocalization;
	children: ReactNode;
}) {
	const { messages, number } = localization;
	const track = useRef<HTMLDivElement>(null);
	const [edge, setEdge] = useState({ start: true, end: true });

	useEffect(() => {
		const element = track.current;
		if (!element) return;
		const update = () =>
			setEdge({
				start: element.scrollLeft <= 1,
				end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 1,
			});
		update();
		element.addEventListener("scroll", update, { passive: true });
		const observer =
			typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(update);
		observer?.observe(element);
		return () => {
			element.removeEventListener("scroll", update);
			observer?.disconnect();
		};
	}, []);

	const scroll = useCallback((direction: 1 | -1) => {
		const element = track.current;
		if (!element) return;
		// 卡片宽度不一，按各卡片的吸附位置逐张前进，而不是按固定步长滚动。
		const padding = Number.parseFloat(getComputedStyle(element).scrollPaddingInlineStart) || 0;
		const origin = element.getBoundingClientRect().left - element.scrollLeft;
		const stops = Array.from(
			element.children,
			(card) => card.getBoundingClientRect().left - origin - padding,
		);
		const current = element.scrollLeft;
		const target =
			direction === 1
				? stops.find((stop) => stop > current + 1)
				: stops.filter((stop) => stop < current - 1).at(-1);
		element.scrollTo({
			left: Math.max(0, target ?? (direction === 1 ? element.scrollWidth : 0)),
			behavior:
				typeof matchMedia === "function" &&
					matchMedia("(prefers-reduced-motion: reduce)").matches
					? "auto"
					: "smooth",
		});
	}, []);

	return (
		<div className="v-tweet__rail">
			<div
				ref={track}
				className="v-tweet__rail-track"
				// biome-ignore lint/a11y/noNoninteractiveTabindex: 可滚动区域必须可聚焦，键盘用户才能用方向键横向滚动。
				tabIndex={0}
				role="group"
				aria-label={formatMessage(messages.photoRail, "count", number.format(count))}
			>
				{children}
			</div>
			<button
				type="button"
				className="v-tweet__rail-button"
				data-direction="previous"
				aria-label={messages.previousPhotos}
				hidden={edge.start}
				onClick={() => scroll(-1)}
			>
				<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
					<path d="M19 12H5M12 5l-7 7 7 7" />
				</svg>
			</button>
			<button
				type="button"
				className="v-tweet__rail-button"
				data-direction="next"
				aria-label={messages.nextPhotos}
				hidden={edge.end}
				onClick={() => scroll(1)}
			>
				<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
					<path d="M5 12h14M12 5l7 7-7 7" />
				</svg>
			</button>
		</div>
	);
}

function PhotoRail(props: TweetPhotosProps) {
	const { photos, localization } = props;
	return (
		<MediaRail count={photos.length} localization={localization}>
			{photos.map((photo, index) => (
				<PhotoLink
					key={`${photo.url}:${index}`}
					{...props}
					index={index}
					style={{ "--_photo-ratio": ratioOf(photo) } as CSSProperties}
				/>
			))}
		</MediaRail>
	);
}

/** 引用卡片缩略图最多展示的张数，其余折叠为最后一格上的「+N」。 */
const THUMB_MAX_VISIBLE = 4;

/**
 * 引用卡片里的照片：固定大小的方形小拼图（1 张整格、2 张并排、3 张一大两小、4 张四宫格），
 * 超过 4 张时最后一格显示「+N」。点击行为与默认展示一致，灯箱仍包含全部照片。
 */
export function TweetThumbnails(props: TweetPhotosProps) {
	const { photos } = props;
	const visible = Math.min(photos.length, THUMB_MAX_VISIBLE);
	const hidden = photos.length - visible;
	return (
		<div className="v-tweet__thumbs" data-count={visible}>
			{photos.slice(0, visible).map((photo, index) => (
				<PhotoLink
					key={`${photo.url}:${index}`}
					{...props}
					index={index}
					hiddenCount={index === visible - 1 ? hidden : 0}
				/>
			))}
		</div>
	);
}

/**
 * 默认的照片展示：竖图为主的多张照片用横向滚动条，其余用方格，单张保持原比例。
 */
export function TweetPhotos(props: TweetPhotosProps) {
	const { photos } = props;
	if (isPortraitSet(photos)) return <PhotoRail {...props} />;
	return (
		<div className="v-tweet__photos" data-count={Math.min(photos.length, 4)}>
			{photos.map((photo, index) => (
				<PhotoLink key={`${photo.url}:${index}`} {...props} index={index} />
			))}
		</div>
	);
}
