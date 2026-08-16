/**
 * ImageGrid - 评论图片九宫格展示组件
 *
 * 布局规则：
 * - 1 张：大图单列（max-w-60）
 * - 2 张：双列
 * - 3+ 张：三列九宫格
 * - 超过 9 张：前 9 张，第 9 张叠加 +N 半透明遮罩
 *
 * 点击任意图片打开 ImagePreview 全屏预览（复用 useImagePreview hook）。
 */
import { ImagePreview, useImagePreview } from "@shared/ui/image-preview";
import { cn } from "@/shared/lib/utils";

export interface ImageGridImage {
	/** 原图 URL */
	url: string;
	/** 缩略图 URL，可选，fallback 到 url */
	thumbnail?: string;
	/** 图片宽度 */
	width?: number;
	/** 图片高度 */
	height?: number;
}

export interface ImageGridProps {
	/** 图片列表 */
	images: ImageGridImage[];
	/** 自定义样式 */
	className?: string;
}

const MAX_DISPLAY = 9;

export function ImageGrid({ images, className }: ImageGridProps) {
	const preview = useImagePreview();

	if (!images || images.length === 0) {
		return null;
	}

	const count = images.length;
	const showMoreOverlay = count > MAX_DISPLAY;
	const displayImages = showMoreOverlay ? images.slice(0, MAX_DISPLAY) : images;
	const moreCount = count - MAX_DISPLAY;

	const getGridClass = () => {
		if (count === 1) return "grid-cols-1 w-full";
		if (count === 2 || count === 4) return "grid-cols-2 gap-1.5 w-full";
		return "grid-cols-3 gap-1.5 w-full";
	};

	const handleClick = (index: number, target: HTMLElement) => {
		const urls = images.map((img) => img.url);
		// 缩略图齐全才传给预览(与原图一一对应):飞入占位 + 底部导航条不拉原图
		const thumbs = images.map((img) => img.thumbnail);
		const thumbnails = thumbs.every((t): t is string => !!t) ? thumbs : undefined;
		preview.openPreview(urls, index, target, thumbnails);
	};

	return (
		<>
			<div className={cn("grid w-full", getGridClass(), className)}>
				{displayImages.map((image, index) => (
					<div
						key={index}
						className={cn(
							"relative overflow-hidden rounded-xl border border-edge-hairline bg-surface/30",
							count === 1
								? "w-full max-h-95 aspect-16/10 sm:aspect-16/9"
								: count === 2
									? "aspect-4/3"
									: "aspect-square",
						)}
					>
						<div
							role="button"
							tabIndex={0}
							className="size-full cursor-pointer rounded border border-edge-hairline bg-cover bg-center transition-opacity hover:opacity-90"
							style={{ backgroundImage: `url(${image.thumbnail || image.url})` }}
							onClick={(e) => handleClick(index, e.currentTarget)}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									e.preventDefault();
									handleClick(index, e.currentTarget);
								}
							}}
						/>
						{showMoreOverlay && index === MAX_DISPLAY - 1 && (
							<div
								role="button"
								tabIndex={0}
								className="absolute inset-0 flex cursor-pointer items-center justify-center rounded bg-black/50"
								onClick={(e) => handleClick(MAX_DISPLAY - 1, e.currentTarget)}
								onKeyDown={(e) => {
									if (e.key === "Enter" || e.key === " ") {
										e.preventDefault();
										handleClick(MAX_DISPLAY - 1, e.currentTarget);
									}
								}}
							>
								<span className="text-xl font-medium text-white">+{moreCount}</span>
							</div>
						)}
					</div>
				))}
			</div>
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
