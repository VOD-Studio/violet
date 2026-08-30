/**
 * PhotoStack - 照片堆叠。
 *
 * 顶图按原始顺序翻页，不循环；展开后使用同尺寸媒体墙。
 */
import { cn } from "@shared/lib/utils";
import { Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { PhotoStackGrid } from "./photo-stack-grid";
import { PhotoStackStage } from "./photo-stack-stage";

export interface PhotoStackImage {
	src: string;
	alt?: string;
}

export interface PhotoStackProps {
	/** 图片列表，按展示顺序排列。 */
	images: PhotoStackImage[];
	/** 卡片下方元信息区。 */
	footer?: React.ReactNode;
	/** 栈面比例，默认竖向 3:4。 */
	aspectClass?: string;
	className?: string;
	/** 点击顶图或展开媒体墙中的图片时返回原始下标。 */
	onImageOpen?: (index: number) => void;
}

/**
 * 照片堆叠：拖拽越过阈值后将当前卡插入后槽，并让下一卡切到顶层。
 *
 * @param images 图片序列
 * @param footer 卡片元信息
 * @param aspectClass 舞台比例
 * @param className 外层样式
 * @param onImageOpen 媒体点击回调
 */
export function PhotoStack({
	images,
	footer,
	aspectClass = "aspect-3/4",
	className,
	onImageOpen,
}: PhotoStackProps) {
	const [currentIndex, setCurrentIndex] = useState(0);
	const [expanded, setExpanded] = useState(false);
	const layoutPrefix = useId();

	useEffect(() => {
		setCurrentIndex((index) => Math.min(index, Math.max(images.length - 1, 0)));
	}, [images.length]);

	if (images.length === 0) return null;

	return (
		<article className={cn("group", className)} data-photo-stack={layoutPrefix}>
			{expanded ? (
				<PhotoStackGrid
					images={images}
					aspectClass={aspectClass}
					onSelect={(index) => {
						setCurrentIndex(index);
						setExpanded(false);
						onImageOpen?.(index);
					}}
				/>
			) : (
				<PhotoStackStage
					images={images}
					currentIndex={currentIndex}
					aspectClass={aspectClass}
					onIndexChange={setCurrentIndex}
					onImageOpen={onImageOpen}
				/>
			)}
			<div className="mt-3 flex items-start justify-between gap-3">
				<div className="min-w-0 flex-1">{footer}</div>
				<button
					type="button"
					onClick={() => setExpanded((value) => !value)}
					aria-expanded={expanded}
					aria-label={expanded ? "收起为堆叠" : `展开全部照片，共 ${images.length} 张`}
					className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-md border border-edge-hairline px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
				>
					{expanded ? (
						<Minimize2 className="size-3.5" />
					) : (
						<Maximize2 className="size-3.5" />
					)}
					<span className="hidden sm:inline">
						{expanded ? "收起" : `展开 ${images.length}`}
					</span>
				</button>
			</div>
		</article>
	);
}
