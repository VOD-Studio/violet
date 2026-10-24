import { parseCrop } from "@shared/lib/crop-url";
import { contentImageSources, contentImageUrl } from "@shared/lib/image-url";
import { cn } from "cn";
import { ImageOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { coverCropTransform, type Size } from "./lib/crop-display";

interface LoadedImage extends Size {
	src: string;
	currentSrc: string;
	/** 当前资源的实际像素宽度；w/h 保留首次解码的几何基准。 */
	currentWidth: number;
	/** 实际选中 URL 的请求档位；原图使用自然宽度。 */
	requestedWidth: number;
}

/** 展示层裁剪契约；候选宽度描述容器，组件负责换算完整源图的像素需求。 */
export interface CroppedImageProps {
	/** 图片 src,可能带 ?crop=x,y,w,h(选区聚焦时) */
	src: string;
	/** 展示宽度；裁剪时按选区占比请求足够宽的完整源图。 */
	width?: number;
	/** 展示宽度请求档位；实际请求还会计入裁剪、cover 与 DPR。 */
	widths?: readonly number[];
	/** 封面可显式传 high；不会替调用方改变 loading。 */
	fetchPriority?: "high" | "low" | "auto";
	/**
	 * 浏览器图片解码提示。
	 *
	 * @default async
	 */
	decoding?: "async" | "sync" | "auto";
	/** 容器宽高比(数字);与 fillContainer 互斥,不传时见 fillContainer */
	aspect?: number;
	/** 容器尺寸完全由 className 决定(absolute 铺满/h-full 等场景)。
	 *  默认不传时,带 ?crop= 的 src 会把选区宽高比写成容器 inline
	 *  aspect-ratio(文档流撑高用);但 absolute 容器 height:auto 下该
	 *  比例会劫持高度、令 bottom inset 失效,图片铺不满格子——此场景
	 *  必须传 true 跳过自然比例 */
	fillContainer?: boolean;
	/** 容器 className */
	className?: string;
	/** 内部 img 的额外 className(如 hover 动画) */
	imgClassName?: string;
	/** img alt */
	alt?: string;
	/** img loading,默认不设 */
	loading?: "lazy" | "eager";
	/** 图片加载完成回调（用于淡入等加载态效果） */
	onLoad?: () => void;
	/** 加载失败回调(组件自身仍渲染占位);调用方可用它做退化排版 */
	onError?: () => void;
}

/**
 * 按作者选区显示图片，并按实际展示宽度选择完整源图的派生资源。
 *
 * @remarks `crop` 只在 CSS 几何中生效，不叠加服务端居中裁剪。
 * 选区与容器比例不同时按 cover 居中；未传 aspect 时以选区比例撑开布局。
 * 裁剪几何就绪前隐藏图片，避免闪现未裁剪的全图；无 crop 时直接展示。
 */
export function CroppedImage({
	src,
	width,
	widths,
	fetchPriority,
	decoding = "async",
	aspect,
	fillContainer,
	className,
	imgClassName,
	alt = "",
	loading,
	onLoad,
	onError,
}: CroppedImageProps) {
	const rect = useMemo(() => parseCrop(src), [src]);
	const ratio = fillContainer ? undefined : (aspect ?? (rect ? rect.w / rect.h : undefined));
	const containerRef = useRef<HTMLDivElement>(null);
	const imgRef = useRef<HTMLImageElement>(null);
	const [natural, setNatural] = useState<LoadedImage | null>(null);
	const [box, setBox] = useState<Size | null>(null);
	const [density, setDensity] = useState(1);
	const sourceScale = rect ? 1 / rect.w : 1;
	const currentNatural = natural?.src === src ? natural : null;
	const transform =
		rect && currentNatural && box ? coverCropTransform(rect, currentNatural, box) : null;
	const fullWidth = transform
		? transform.width
		: currentNatural && box
			? Math.max(box.w, (box.h * currentNatural.w) / currentNatural.h)
			: (box?.w ?? width ?? 0) * sourceScale;
	const requiredWidth = Math.ceil(fullWidth * density);
	const requestWidth =
		widths
			?.map((candidate) => Math.ceil(candidate * sourceScale))
			.find((candidate) => candidate >= requiredWidth) ?? requiredWidth;
	const canReuse =
		currentNatural &&
		(currentNatural.currentWidth >= requiredWidth ||
			currentNatural.requestedWidth >= requestWidth);
	const displaySrc = canReuse
		? currentNatural.currentSrc
		: requestWidth
			? contentImageUrl(src, { width: requestWidth })
			: src;
	const sources =
		!currentNatural && widths
			? contentImageSources(
					src,
					widths.map((candidate) => Math.ceil(candidate * sourceScale)),
					width === undefined ? undefined : Math.ceil(width * sourceScale),
				)
			: [];
	const [failedFor, setFailedFor] = useState<string | null>(null);
	const failed = failedFor === displaySrc;
	const captureImage = useCallback(
		(image: HTMLImageElement) => {
			const currentSrc = image.currentSrc || image.src;
			const currentWidth = image.naturalWidth;
			const currentHeight = image.naturalHeight;
			const requestedWidth =
				Number(new URL(currentSrc).searchParams.get("w")) || currentWidth;
			setNatural((previous) => {
				const sameSource = previous?.src === src;
				if (
					sameSource &&
					previous.currentSrc === currentSrc &&
					previous.currentWidth === currentWidth
				) {
					return previous;
				}
				// 派生高度取整会改变宽高比；反馈到选图会在相邻宽度间无限循环。
				return {
					src,
					w: sameSource ? previous.w : currentWidth,
					h: sameSource ? previous.h : currentHeight,
					currentSrc,
					currentWidth,
					requestedWidth,
				};
			});
		},
		[src],
	);

	// 容器尺寸:首次测量 + ResizeObserver 跟踪(容器随视口响应式变化)
	useEffect(() => {
		if (!rect && !width && !widths) return;
		const el = containerRef.current;
		if (!el) return;
		const measure = () => {
			const w = el.offsetWidth;
			const h = el.offsetHeight;
			setBox((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
			setDensity(window.devicePixelRatio || 1);
		};
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		window.addEventListener("resize", measure);
		const resolution = window.matchMedia(`(resolution: ${density}dppx)`);
		resolution.addEventListener("change", measure);
		return () => {
			ro.disconnect();
			window.removeEventListener("resize", measure);
			resolution.removeEventListener("change", measure);
		};
	}, [rect, width, widths, density]);

	// 水合前已完成的候选继续复用，不因测量后需要较小档位而重新下载。
	useEffect(() => {
		const image = imgRef.current;
		if (image?.complete && image.naturalWidth > 0) captureImage(image);
	}, [captureImage]);

	// 失败兜底：容器尺寸照旧（调用方 className 撑住布局），灰底 + 图标占位
	if (failed) {
		return (
			<div
				role="img"
				aria-label={alt}
				className={cn(
					"flex items-center justify-center overflow-hidden bg-muted",
					className,
				)}
				style={ratio ? { aspectRatio: ratio } : undefined}
			>
				<ImageOff className="size-8 max-h-[60%] max-w-[60%] text-muted-foreground/50" />
			</div>
		);
	}

	return (
		<div
			ref={containerRef}
			className={cn(rect ? "relative overflow-hidden" : "overflow-hidden", className)}
			style={ratio ? { aspectRatio: ratio } : undefined}
		>
			<picture>
				{sources.map((source) => (
					<source key={source.media} {...source} />
				))}
				<img
					ref={imgRef}
					src={displaySrc}
					fetchPriority={fetchPriority}
					decoding={decoding}
					alt={alt}
					loading={loading}
					onLoad={(e) => {
						captureImage(e.currentTarget);
						onLoad?.();
					}}
					onError={() => {
						setFailedFor(displaySrc);
						onError?.();
					}}
					className={cn(
						rect ? "absolute max-w-none" : "h-full w-full object-cover",
						imgClassName,
					)}
					style={
						transform
							? {
									width: transform.width,
									height: transform.height,
									left: transform.left,
									top: transform.top,
								}
							: rect
								? { visibility: "hidden" }
								: undefined
					}
				/>
			</picture>
		</div>
	);
}
