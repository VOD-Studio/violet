import { type MotionValue, motion } from "motion/react";
import type { MouseEventHandler } from "react";
import type { PhotoStackImage } from "./photo-stack";

export interface PhotoStackCardProps {
	/** 媒体资源。 */
	image: PhotoStackImage;
	/** 卡片水平位移。 */
	x: MotionValue<number>;
	/** 卡片垂直位移。 */
	y: MotionValue<number>;
	/** 卡片平面旋转角度。 */
	rotate: MotionValue<number>;
	/** 卡片 Y 轴透视旋转角度。 */
	rotateY: MotionValue<number>;
	/** 卡片缩放比例。 */
	scale: MotionValue<number>;
	/** 卡片透明度。 */
	opacity: MotionValue<number>;
	/** 堆叠层级。 */
	zIndex: number;
	/** 当前卡或左右后置卡。 */
	state: "current" | "left" | "right";
	/** 后置深度，顶卡为 0。 */
	depth: number;
	/** 仅顶卡提供点击回调，后置卡保持不可交互。 */
	onClick?: MouseEventHandler<HTMLButtonElement>;
}
export function PhotoStackCard({
	image,
	x,
	y,
	rotate,
	rotateY,
	scale,
	opacity,
	zIndex,
	state,
	depth,
	onClick,
}: PhotoStackCardProps) {
	return (
		<motion.button
			type="button"
			className="absolute left-[4%] top-0 h-full w-[92%] rounded-lg border border-edge-hairline bg-background shadow-md"
			style={{
				x,
				y,
				rotate,
				rotateY,
				scale,
				opacity,
				zIndex,
				transformOrigin: "50% 50%",
				transformPerspective: 900,
			}}
			disabled={!onClick}
			data-card-state={state}
			data-card-depth={depth}
			data-card-z={zIndex}
			onClick={onClick}
		>
			<img
				src={image.src}
				alt={image.alt ?? ""}
				loading={state === "current" ? "eager" : "lazy"}
				draggable={false}
				className="size-full rounded-lg object-cover"
			/>
		</motion.button>
	);
}
