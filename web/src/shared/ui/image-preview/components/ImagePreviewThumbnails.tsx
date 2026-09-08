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
							"relative size-10 shrink-0 overflow-hidden rounded-md border border-white/20 bg-black/40 opacity-65 outline-none transition-[border-color,box-shadow,opacity] hover:border-white/50 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-white/80 sm:size-12",
							index === currentIndex &&
								"border-white opacity-100 shadow-[0_0_0_2px_rgba(0,0,0,0.65),0_0_0_4px_rgba(255,255,255,0.9)]",
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
