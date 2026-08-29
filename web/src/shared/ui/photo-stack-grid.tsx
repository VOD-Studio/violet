import { motion } from "motion/react";
import { useId } from "react";
import type { PhotoStackImage } from "./photo-stack";

export interface PhotoStackGridProps {
	/** 媒体资源列表。 */
	images: PhotoStackImage[];
	/** 与折叠舞台一致的比例类。 */
	aspectClass: string;
	/** 选择媒体后返回原始索引。 */
	onSelect: (index: number) => void;
}

/** 与折叠舞台同尺寸的展开媒体墙。 */
export function PhotoStackGrid({ images, aspectClass, onSelect }: PhotoStackGridProps) {
	const layoutPrefix = useId();
	return (
		<motion.div
			layout
			className={`relative isolate mx-auto w-[72%] overflow-y-auto rounded-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${aspectClass}`}
		>
			<div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
				{images.map((image, index) => (
					<button
						type="button"
						key={`${layoutPrefix}-${image.src}-${index}`}
						className="relative overflow-hidden rounded-md"
						onClick={() => onSelect(index)}
						aria-label={image.alt ?? `打开第 ${index + 1} 张照片`}
					>
						<img
							src={image.src}
							alt={image.alt ?? `照片 ${index + 1}`}
							loading="lazy"
							draggable={false}
							className="aspect-3/4 w-full object-cover"
						/>
					</button>
				))}
			</div>
		</motion.div>
	);
}
