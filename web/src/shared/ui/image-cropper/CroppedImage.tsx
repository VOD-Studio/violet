import { parseCrop } from "@shared/lib/crop-url";
import { contentImageUrl } from "@shared/lib/image-url";
import { ImageOff } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/shared/lib/utils";
import { coverCropTransform, type Size } from "./lib/crop-display";

export interface CroppedImageProps {
	/** 图片 src,可能带 ?crop=x,y,w,h(选区聚焦时) */
	src: string;
	/** 显示宽度档:传则走 contentImageUrl 缩略(webp,GIF 剥参数保动画),
	 * crop 参数经合并保留;不传则原图直出(兼容旧行为) */
	width?: number;
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
	/** 加载失败回调(组件自身仍渲染占位);调用方可用它做退化排版 */
	onError?: () => void;
}

/**
 * CroppedImage - 显示层图片,支持选区精确复现。
 *
 * 解析 src 的 ?crop= 参数,把选区当作图片本身 cover 进容器:
 * 实测容器与原图尺寸,显式设置 img 的 width/height/left/top(不叠加
 * object-fit/transform scale,避免历史的「双重放大」)。选区宽高比与容器
 * 一致时四边精确贴合;不一致时选区铺满容器、溢出维度居中裁切。
 * 无 ?crop= 退化普通居中 cover。静态图/GIF 统一,原图无损。
 *
 * 不传 aspect 时容器按选区宽高比撑高——自然比例场景下,选区就是作者
 * 定下的画面比例;无选区则维持原图自然比例。
 *
 * 测量就绪前 img 隐藏,避免闪现未裁剪的全图。
 */
export function CroppedImage({
	src,
	width,
	aspect,
	fillContainer,
	className,
	imgClassName,
	alt = "",
	loading,
	onError,
}: CroppedImageProps) {
	const rect = useMemo(() => parseCrop(src), [src]);
	const ratio = fillContainer ? undefined : (aspect ?? (rect ? rect.w / rect.h : undefined));
	const containerRef = useRef<HTMLDivElement>(null);
	const imgRef = useRef<HTMLImageElement>(null);
	const [natural, setNatural] = useState<Size | null>(null);
	const [box, setBox] = useState<Size | null>(null);
	// 加载失败兜底：外链图失效时占位，避免露出原生碎图。
	// 失败态按 src 记录——src 变化天然重置，无需 reset effect
	const displaySrc = width ? contentImageUrl(src, { width }) : src;
	const [failedFor, setFailedFor] = useState<string | null>(null);
	const failed = failedFor === displaySrc;

	// 容器尺寸:首次测量 + ResizeObserver 跟踪(容器随视口响应式变化)
	useEffect(() => {
		if (!rect) return;
		const el = containerRef.current;
		if (!el) return;
		const measure = () => {
			const r = el.getBoundingClientRect();
			setBox((prev) =>
				prev && prev.w === r.width && prev.h === r.height
					? prev
					: { w: r.width, h: r.height },
			);
		};
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		return () => ro.disconnect();
	}, [rect]);

	// 换图后旧自然尺寸作废,等新图 load;缓存命中的图不再触发 load,直接读
	// biome-ignore lint/correctness/useExhaustiveDependencies: displaySrc 是重置触发器,函数体内经 imgRef 间接消费
	useEffect(() => {
		if (!rect) return;
		setNatural(null);
		const img = imgRef.current;
		if (img?.complete && img.naturalWidth > 0) {
			setNatural({ w: img.naturalWidth, h: img.naturalHeight });
		}
	}, [rect, displaySrc]);

	const transform = rect && natural && box ? coverCropTransform(rect, natural, box) : null;

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

	// 无 ?crop=:普通居中 cover(旧行为)
	if (!rect) {
		return (
			<div
				className={cn("overflow-hidden", className)}
				style={ratio ? { aspectRatio: ratio } : undefined}
			>
				<img
					src={displaySrc}
					alt={alt}
					loading={loading}
					onError={() => {
						setFailedFor(displaySrc);
						onError?.();
					}}
					className={cn("h-full w-full object-cover", imgClassName)}
				/>
			</div>
		);
	}

	return (
		<div
			ref={containerRef}
			className={cn("relative overflow-hidden", className)}
			style={ratio ? { aspectRatio: ratio } : undefined}
		>
			<img
				ref={imgRef}
				src={displaySrc}
				alt={alt}
				loading={loading}
				onLoad={(e) =>
					setNatural({
						w: e.currentTarget.naturalWidth,
						h: e.currentTarget.naturalHeight,
					})
				}
				onError={() => {
					setFailedFor(displaySrc);
					onError?.();
				}}
				className={cn("absolute max-w-none", imgClassName)}
				style={
					transform
						? {
								width: transform.width,
								height: transform.height,
								left: transform.left,
								top: transform.top,
							}
						: { visibility: "hidden" }
				}
			/>
		</div>
	);
}
