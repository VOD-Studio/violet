import { contentImageUrl } from "@shared/lib/image-url";
import { ImagePreview, useImagePreview } from "@shared/ui/image-preview";
import { cn } from "cn";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { TweetImageRef } from "@/entities/tweet/model/types";

export interface TweetDetailMediaProps {
	/** 本站推文图片，按发布顺序。 */
	images: TweetImageRef[];
	className?: string;
}

/**
 * 详情页的大图查看区：一张大图加缩略图条，可用箭头与方向键切换，点击进入灯箱看原图。
 *
 * 大图在固定高度的舞台里完整显示（contain），竖图、横图都不裁切；
 * 只有一张图时不显示切换控件。
 */
export function TweetDetailMedia({ images, className }: TweetDetailMediaProps) {
	const [index, setIndex] = useState(0);
	const preview = useImagePreview();
	if (images.length === 0) return null;
	const urls = images.map((img) => img.url);
	const current = Math.min(index, images.length - 1);
	const many = images.length > 1;
	const go = (next: number) => setIndex((next + images.length) % images.length);

	return (
		<div className={cn("flex flex-col gap-3", className)}>
			<div
				role="group"
				aria-roledescription="图片查看器"
				aria-label={`推文图片，共 ${images.length} 张`}
				tabIndex={many ? 0 : undefined}
				onKeyDown={(event) => {
					if (!many) return;
					if (event.key === "ArrowLeft") go(current - 1);
					if (event.key === "ArrowRight") go(current + 1);
				}}
				className="group/stage relative flex min-h-56 items-center justify-center overflow-hidden rounded-xl bg-muted/50 lg:h-[min(72svh,760px)] ring-1 ring-border ring-inset outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				<button
					type="button"
					aria-label={`放大查看第 ${current + 1} 张图片`}
					onClick={(event) =>
						preview.openPreview(
							urls,
							current,
							event.currentTarget,
							urls.map((url) => contentImageUrl(url, { width: 400 })),
						)
					}
					className="flex size-full cursor-zoom-in items-center justify-center"
				>
					<img
						src={contentImageUrl(urls[current], { width: 1200 })}
						alt={`推文图片 ${current + 1}`}
						className="max-h-[75svh] max-w-full object-contain lg:max-h-full"
					/>
				</button>
				{many && (
					<>
						<button
							type="button"
							aria-label="上一张"
							onClick={() => go(current - 1)}
							className="absolute top-1/2 left-3 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-background/80 text-foreground opacity-0 ring-1 ring-border backdrop-blur transition-opacity group-hover/stage:opacity-100 group-focus-within/stage:opacity-100 hover:bg-background [@media(hover:none)]:opacity-100"
						>
							<ChevronLeft className="size-5" />
						</button>
						<button
							type="button"
							aria-label="下一张"
							onClick={() => go(current + 1)}
							className="absolute top-1/2 right-3 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-background/80 text-foreground opacity-0 ring-1 ring-border backdrop-blur transition-opacity group-hover/stage:opacity-100 group-focus-within/stage:opacity-100 hover:bg-background [@media(hover:none)]:opacity-100"
						>
							<ChevronRight className="size-5" />
						</button>
						<span className="absolute right-3 bottom-3 rounded-full bg-background/80 px-2.5 py-0.5 font-mono text-xs text-foreground tabular-nums ring-1 ring-border backdrop-blur">
							{current + 1} / {images.length}
						</span>
					</>
				)}
			</div>
			{many && (
				<ul className="-m-1 flex gap-2 overflow-x-auto p-1">
					{images.map((img, i) => (
						<li key={`${img.url}:${i}`} className="shrink-0">
							<button
								type="button"
								aria-label={`查看第 ${i + 1} 张图片`}
								aria-current={i === current}
								onClick={() => setIndex(i)}
								className={cn(
									"block size-16 overflow-hidden rounded-lg ring-1 ring-border transition-opacity ring-inset",
									i === current
										? "ring-2 ring-primary"
										: "opacity-70 hover:opacity-100",
								)}
							>
								<img
									src={contentImageUrl(img.url, { width: 200 })}
									alt=""
									loading="lazy"
									className="size-full object-cover"
								/>
							</button>
						</li>
					))}
				</ul>
			)}
			<ImagePreview
				open={preview.open}
				images={preview.images}
				thumbnails={preview.thumbnails}
				currentIndex={preview.currentIndex}
				triggerElement={preview.triggerElement}
				onClose={preview.closePreview}
				onIndexChange={(next) => {
					preview.setCurrentIndex(next);
					setIndex(next);
				}}
			/>
		</div>
	);
}
