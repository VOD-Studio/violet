import type { MotionValue } from "motion/react";
import type { PhotoStackImage } from "./photo-stack";
import { PhotoStackCard } from "./photo-stack-card";
import { getDirectionalZ } from "./photo-stack-motion";

export interface PhotoStackCardMotion {
	x: MotionValue<number>;
	y: MotionValue<number>;
	rotate: MotionValue<number>;
	scale: MotionValue<number>;
}

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
	/** 用于区分同页多个 PhotoStack 的稳定前缀。 */
	layoutPrefix: string;
	/** 为媒体索引提供持久 MotionValue。 */
	motionOf: (image: PhotoStackImage, index: number) => PhotoStackCardMotion;
	/** 当前顶图点击回调。 */
	onCurrentClick: () => void;
	/** 拖拽目标侧，用于覆盖层级。 */
	dragDirection: "left" | "right" | null;
}

/** 舞台中的后置卡与顶卡，保持拖拽逻辑和媒体标记分离。 */
export function PhotoStackCards({
	visibleCards,
	current,
	currentIndex,
	layoutPrefix,
	motionOf,
	onCurrentClick,
	dragDirection,
}: PhotoStackCardsProps) {
	return (
		<>
			{visibleCards.map((card) => {
				const value = motionOf(card.image, card.index);
				return (
					<PhotoStackCard
						key={`${layoutPrefix}-${card.index}`}
						image={card.image}
						x={value.x}
						y={value.y}
						rotate={value.rotate}
						scale={value.scale}
						zIndex={getDirectionalZ(dragDirection, card.axis, card.depth)}
						state={card.axis}
						depth={card.depth}
					/>
				);
			})}
			<PhotoStackCard
				key={`${layoutPrefix}-current-${currentIndex}`}
				image={current}
				x={motionOf(current, currentIndex).x}
				y={motionOf(current, currentIndex).y}
				rotate={motionOf(current, currentIndex).rotate}
				scale={motionOf(current, currentIndex).scale}
				zIndex={100}
				state="current"
				depth={0}
				onClick={onCurrentClick}
			/>
		</>
	);
}
