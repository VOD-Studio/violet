import type { PhotoStackImage } from "./photo-stack";
import { PhotoStackCard } from "./photo-stack-card";
import {
	cardMotionKey,
	getDirectionalZ,
	getStackSlot,
	type MotionBundle,
	type PhotoStackSlot,
} from "./photo-stack-motion";

export type PhotoStackCardMotion = MotionBundle;

export interface PhotoStackVisibleCard {
	image: PhotoStackImage;
	index: number;
	depth: number;
	axis: "left" | "right";
}

export interface PhotoStackCardsProps {
	/** 当前索引两侧最多三层后置卡。 */
	visibleCards: PhotoStackVisibleCard[];
	/** 当前顶图。 */
	current: PhotoStackImage;
	/** 当前顶图在原始列表中的索引。 */
	currentIndex: number;
	/** 舞台像素宽度，用于给新挂载的卡计算初始槽位。 */
	stackWidth: number;
	/** 用于区分同页多个 PhotoStack 的稳定前缀。 */
	layoutPrefix: string;
	/** 为媒体索引提供持久 MotionValue。 */
	motionOf: (
		image: PhotoStackImage,
		index: number,
		init?: PhotoStackSlot,
	) => PhotoStackCardMotion;
	/** 当前顶图点击回调。 */
	onCurrentClick: () => void;
	/** 拖拽目标侧，用于覆盖层级。 */
	dragDirection: "left" | "right" | null;
	/** 是否已达到或超过拉出阈值，用于决定顶卡与目标卡层级反转。 */
	isPastThreshold?: boolean;
}

/** 舞台中的后置卡与顶卡，保持拖拽逻辑和媒体标记分离。 */
export function PhotoStackCards({
	visibleCards,
	current,
	currentIndex,
	stackWidth,
	layoutPrefix,
	motionOf,
	onCurrentClick,
	dragDirection,
	isPastThreshold = false,
}: PhotoStackCardsProps) {
	const currentMotion = motionOf(current, currentIndex, { x: 0, y: 0, rotate: 0, scale: 1 });

	return (
		<>
			{visibleCards.map((card) => {
				const value = motionOf(
					card.image,
					card.index,
					getStackSlot(card.axis, card.depth, stackWidth),
				);
				return (
					<PhotoStackCard
						key={`${layoutPrefix}-${cardMotionKey(card.image.src, card.index)}`}
						image={card.image}
						x={value.x}
						y={value.y}
						rotate={value.rotate}
						rotateY={value.rotateY}
						scale={value.scale}
						opacity={value.opacity}
						zIndex={getDirectionalZ(
							dragDirection,
							card.axis,
							card.depth,
							isPastThreshold,
						)}
						state={card.axis}
						depth={card.depth}
					/>
				);
			})}
			<PhotoStackCard
				key={`${layoutPrefix}-${cardMotionKey(current.src, currentIndex)}`}
				image={current}
				x={currentMotion.x}
				y={currentMotion.y}
				rotate={currentMotion.rotate}
				rotateY={currentMotion.rotateY}
				scale={currentMotion.scale}
				opacity={currentMotion.opacity}
				zIndex={isPastThreshold ? 90 : 100}
				state="current"
				depth={0}
				onClick={onCurrentClick}
			/>
		</>
	);
}
