import { cn } from "cn";
import { type ComponentPropsWithRef, type CSSProperties, useState } from "react";

/** 网格中的缩略图；完整图片与灯箱由宿主持有。 */
export interface ImageGridImage {
	src: string;
	alt?: string;
	width?: number;
	height?: number;
}

/** 点击回调总是携带屏幕上真实的 img，供宿主作为灯箱动画起点。 */
export interface ImageGridProps extends Omit<ComponentPropsWithRef<"div">, "children"> {
	images: readonly ImageGridImage[];
	onImageClick: (index: number, image: HTMLImageElement) => void;
}

function ImageCell({
	image,
	index,
	total,
	onImageClick,
}: {
	image: ImageGridImage;
	index: number;
	total: number;
	onImageClick: ImageGridProps["onImageClick"];
}) {
	const [naturalRatio, setNaturalRatio] = useState<number>();
	const ratio = image.width && image.height ? image.width / image.height : naturalRatio;
	const style =
		total === 1 && ratio && ratio > 0
			? ({ "--v-image-grid-ratio": Math.min(ratio, 16 / 9) } as CSSProperties)
			: undefined;
	return (
		<button
			type="button"
			className="v-image-grid__cell"
			style={style}
			aria-label={`查看第 ${index + 1} 张，共 ${total} 张`}
			onClick={(event) => {
				const thumbnail = event.currentTarget.querySelector("img");
				if (thumbnail) onImageClick(index, thumbnail);
			}}
		>
			<img
				src={image.src}
				alt={image.alt ?? ""}
				width={image.width}
				height={image.height}
				loading="lazy"
				decoding="async"
				onLoad={(event) => {
					if (
						total === 1 &&
						!(image.width && image.height) &&
						event.currentTarget.naturalHeight > 0
					) {
						setNaturalRatio(
							event.currentTarget.naturalWidth / event.currentTarget.naturalHeight,
						);
					}
				}}
			/>
			{total > 4 && index === 3 && (
				<span className="v-image-grid__more" aria-hidden="true">
					+{total - 3}
				</span>
			)}
		</button>
	);
}

/** 按图片数量排布最多四张缩略图，不接管灯箱或完整图片加载。 */
export function ImageGrid({ images, onImageClick, className, ...props }: ImageGridProps) {
	if (images.length === 0) return null;
	return (
		<div
			{...props}
			className={cn("v-image-grid", className)}
			data-count={Math.min(images.length, 4)}
		>
			{images.slice(0, 4).map((image, index) => (
				<ImageCell
					key={`${index}:${image.src}`}
					image={image}
					index={index}
					total={images.length}
					onImageClick={onImageClick}
				/>
			))}
		</div>
	);
}
