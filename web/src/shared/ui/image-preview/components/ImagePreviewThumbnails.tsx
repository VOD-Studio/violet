import { motion } from "motion/react";
import { cn } from "@/shared/lib/utils";

interface ImagePreviewThumbnailsProps {
	images: string[];
	currentIndex: number;
	onSelect: (index: number) => void;
}

/** 提供 2 至 10 张图片的缩略图导航。 */
export function ImagePreviewThumbnails({
	images,
	currentIndex,
	onSelect,
}: ImagePreviewThumbnailsProps) {
	if (images.length <= 1 || images.length > 10) return null;

	return (
		<motion.div
			id="image-preview-list"
			role="listbox"
			aria-label="图片列表"
			aria-activedescendant={`image-preview-thumbnail-${currentIndex}`}
			initial={{ opacity: 0, y: 12 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: 12 }}
			transition={{ duration: 0.18, ease: [0.22, 0.61, 0.36, 1] }}
			className="absolute bottom-2 left-1/2 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 overflow-x-auto rounded-lg bg-black/50 p-1.5 backdrop-blur-sm sm:bottom-4 sm:p-2"
		>
			<div className="flex gap-1.5 sm:gap-2">
				{images.map((img, index) => (
					<button
						id={`image-preview-thumbnail-${index}`}
						type="button"
						role="option"
						aria-selected={index === currentIndex}
						key={img}
						onClick={(event) => {
							event.stopPropagation();
							onSelect(index);
						}}
						className={cn(
							"size-10 shrink-0 overflow-hidden rounded border-2 transition-all sm:size-12",
							index === currentIndex
								? "scale-110 border-white"
								: "border-white/30 hover:border-white/60",
						)}
					>
						<img
							src={img}
							alt={`缩略图 ${index + 1}`}
							className="h-full w-full object-cover"
							loading="lazy"
						/>
					</button>
				))}
			</div>
		</motion.div>
	);
}
