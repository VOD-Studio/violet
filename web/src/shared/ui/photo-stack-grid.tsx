import { motion } from "motion/react";
import { useId } from "react";
import type { PhotoStackImage } from "./photo-stack";

export interface PhotoStackGridProps {
	/** 媒体资源列表。 */
	images: PhotoStackImage[];
	/** 选择媒体后返回原始索引；展开态保持不变，由调用方决定是否收起。 */
	onSelect: (index: number) => void;
}

/** 展开后的资料册：按自然比例全宽纵排，逐张错峰进入，点击进入预览。 */
export function PhotoStackGrid({ images, onSelect }: PhotoStackGridProps) {
	const layoutPrefix = useId();
	return (
		<div className="flex flex-col gap-3">
			{images.map((image, index) => (
				<motion.button
					type="button"
					key={`${layoutPrefix}-${image.src}-${index}`}
					initial={{ opacity: 0, y: 24 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{
						opacity: 0,
						y: -16,
						transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
					}}
					transition={{
						delay: index * 0.06,
						duration: 0.4,
						ease: [0.22, 1, 0.36, 1],
					}}
					onClick={() => onSelect(index)}
					aria-label={image.alt ?? `打开第 ${index + 1} 张照片`}
					className="group relative overflow-hidden rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2"
				>
					<img
						src={image.src}
						alt={image.alt ?? `照片 ${index + 1}`}
						loading="lazy"
						draggable={false}
						className="w-full transition-transform duration-300 group-hover:scale-[1.008] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
					/>
				</motion.button>
			))}
		</div>
	);
}
