import { ImagePreview, useImagePreview } from "@shared/ui/image-preview";
import { ImageGrid as ThumbnailGrid } from "@violet/ui";

/** 完整图片与可选的等比例缩略图。 */
export interface ImageGridImage {
	url: string;
	thumbnail?: string;
	width?: number;
	height?: number;
	alt?: string;
}

/** 本站灯箱的图片输入与布局容器。 */
export interface ImageGridProps {
	images: ImageGridImage[];
	className?: string;
}

/** 将通用缩略图网格接入本站灯箱；布局仅由 @violet/ui 实现。 */
export function ImageGrid({ images, className }: ImageGridProps) {
	const preview = useImagePreview();
	if (images.length === 0) return null;
	return (
		<>
			<ThumbnailGrid
				className={className}
				images={images.map((image) => ({
					src: image.thumbnail ?? image.url,
					alt: image.alt,
					width: image.width,
					height: image.height,
				}))}
				onImageClick={(index, thumbnail) => {
					const thumbs = images.map((image) => image.thumbnail);
					preview.openPreview(
						images.map((image) => image.url),
						index,
						thumbnail,
						thumbs.every((thumb): thumb is string => !!thumb) ? thumbs : undefined,
					);
				}}
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
