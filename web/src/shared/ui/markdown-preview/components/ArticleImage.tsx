import { contentImageSources, contentImageUrl } from "@shared/lib/image-url";
import { cn } from "cn";
import type { ComponentPropsWithoutRef } from "react";
import { useEffect, useRef, useState } from "react";
import type { ExtraProps } from "react-markdown";

const IMAGE_WIDTHS = [360, 480, 720, 920, 1200, 1840, 2400, 4096] as const;

/**
 * 正文图片的原生属性；已知尺寸由作者提供，增强层不伪造素材比例。
 *
 * @remarks `node` 仅用于 Markdown 组件映射，不写入 DOM。
 */
export interface ArticleImageProps extends ComponentPropsWithoutRef<"img">, ExtraProps {
	/** 作者提供响应式候选时使用的展示尺寸，不为未知尺寸图片自动启用 size containment。 */
	sizes?: string;
}

/**
 * 保留作者尺寸，通过原生懒加载、异步解码和响应式候选交付正文图片。
 *
 * @remarks 缺少尺寸时只预留最小空间，加载后恢复素材自然比例；原图预览仍使用源 URL。
 */
export function ArticleImage({
	src,
	alt = "",
	width,
	height,
	style,
	className,
	srcSet,
	sizes,
	onLoad,
	node: _node,
	...props
}: ArticleImageProps) {
	const imageRef = useRef<HTMLImageElement>(null);
	const [loadedSource, setLoadedSource] = useState<string | undefined>();
	useEffect(() => {
		// SSR 阶段已发生的 load 不会在水合后重播，缓存图片也需要释放占位。
		const image = imageRef.current;
		if (image?.complete && image.naturalWidth > 0) setLoadedSource(src);
	}, [src]);
	const hasDimensions =
		(Number(width) > 0 && Number(height) > 0) ||
		(style?.width != null &&
			style.width !== "auto" &&
			style.height != null &&
			style.height !== "auto");
	const needsPlaceholder =
		!hasDimensions &&
		loadedSource !== src &&
		!(Number(height) > 0) &&
		(style?.height == null || style.height === "auto");
	const authorWidth = style?.width ?? width;
	const pixelWidth =
		typeof authorWidth === "number"
			? authorWidth
			: typeof authorWidth === "string" && /^\d+(?:\.\d+)?(?:px)?$/.test(authorWidth)
				? Number.parseFloat(authorWidth)
				: undefined;
	const sources = src && !srcSet ? contentImageSources(src, IMAGE_WIDTHS, pixelWidth ?? 920) : [];
	const image = (
		<img
			{...props}
			ref={imageRef}
			src={src ? contentImageUrl(src, { width: 1200 }) : undefined}
			srcSet={srcSet}
			sizes={sizes}
			alt={alt}
			width={width}
			height={height}
			loading="lazy"
			decoding="async"
			className={cn(
				"my-8 max-w-full rounded-2xl ring-1 ring-border shadow-[0_4px_24px_rgb(0_0_0/0.05)]",
				className,
			)}
			style={{
				height: width && height ? "auto" : undefined,
				...style,
				// 无元数据时只预留最小空间，不捏造宽高比或裁剪正文内容。
				...(needsPlaceholder
					? {
							minHeight: style?.minHeight ?? 96,
							objectFit: style?.objectFit ?? "contain",
						}
					: {}),
			}}
			onLoad={(event) => {
				setLoadedSource(src);
				onLoad?.(event);
			}}
		/>
	);
	return sources.length > 0 ? (
		<picture>
			{sources.map((source) => (
				<source key={source.media} {...source} />
			))}
			{image}
		</picture>
	) : (
		image
	);
}
