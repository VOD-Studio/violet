/**
 * PhotoStack - 照片堆叠。
 *
 * 顶图按原始顺序翻页，不循环；展开后使用同尺寸媒体墙。
 */
import { cn } from "@shared/lib/utils";
import { Maximize2, Minimize2 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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
	/** 折叠态顶图的原生加载策略，默认 eager。 */
	loading?: "eager" | "lazy";
	className?: string;
	/** 是否渲染舞台浮动覆盖层（左下页码胶囊与底部拖动把手），默认 true。 */
	overlay?: boolean;
	/** 自定义展开态渲染。未提供时默认使用媒体墙。 */
	renderExpanded?: (props: {
		images: PhotoStackImage[];
		currentIndex: number;
		collapse: () => void;
	}) => React.ReactNode;
	/** 点击顶图或展开媒体墙中的图片时返回原始下标。 */
	onImageOpen?: (index: number) => void;
}

/**
 * 照片堆叠：拖拽越过阈值后将当前卡插入后槽，并让下一卡切到顶层。
 *
 * @param images 图片序列
 * @param footer 卡片元信息
 * @param aspectClass 舞台比例
 * @param loading 折叠态顶图加载策略
 * @param overlay 是否渲染舞台浮动覆盖层
 * @param className 外层样式
 * @param onImageOpen 媒体点击回调
 */
export function PhotoStack({
	images,
	footer,
	aspectClass = "aspect-3/4",
	loading,
	className,
	overlay = true,
	renderExpanded,
	onImageOpen,
}: PhotoStackProps) {
	const [currentIndex, setCurrentIndex] = useState(0);
	const [expanded, setExpanded] = useState(false);
	const layoutPrefix = useId();
	const reduceMotion = useReducedMotion();

	useEffect(() => {
		setCurrentIndex((index) => Math.min(index, Math.max(images.length - 1, 0)));
	}, [images.length]);

	if (images.length === 0) return null;

	const swap = reduceMotion ? { duration: 0 } : { duration: 0.18 };

	return (
		<article className={cn("group", className)} data-photo-stack={layoutPrefix}>
			{/* 容器 layout：展开/收起时高度平滑生长或收拢，popLayout 交叉避免空窗 */}
			<motion.div
				layout
				transition={
					reduceMotion ? { duration: 0 } : { duration: 0.35, ease: [0.22, 1, 0.36, 1] }
				}
			>
				<AnimatePresence initial={false} mode="popLayout">
					{expanded ? (
						<motion.div
							key="expanded"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={swap}
						>
							{renderExpanded ? (
								renderExpanded({
									images,
									currentIndex,
									collapse: () => setExpanded(false),
								})
							) : (
								<PhotoStackGrid
									images={images}
									onSelect={(index) => {
										setCurrentIndex(index);
										onImageOpen?.(index);
									}}
								/>
							)}
						</motion.div>
					) : (
						<motion.div
							key="stage"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={swap}
						>
							<PhotoStackStage
								images={images}
								currentIndex={currentIndex}
								aspectClass={aspectClass}
								loading={loading}
								overlay={overlay}
								onIndexChange={setCurrentIndex}
								onImageOpen={onImageOpen}
							/>
						</motion.div>
					)}
				</AnimatePresence>
			</motion.div>
			<div className="mt-3 flex items-start justify-between gap-3">
				<div className="min-w-0 flex-1">{footer}</div>
				<button
					type="button"
					onClick={() => setExpanded((value) => !value)}
					aria-expanded={expanded}
					aria-label={expanded ? "收起为堆叠" : `展开全部照片，共 ${images.length} 张`}
					className="mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-medium text-muted-foreground/80 transition-colors duration-200 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
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
