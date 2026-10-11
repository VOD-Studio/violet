import { cn } from "cn";
import { motion } from "motion/react";

import { type AccumulationPoint, formatPointPeriod } from "./home-accumulation-model";
import { revealVariants } from "./home-accumulation-motion";

interface HomeAccumulationPointProps {
	point: AccumulationPoint;
	reduceMotion: boolean | null;
	/** 节点在所在轨道内的百分比位置。 */
	position: number;
	/** 轨道线条抵达该位置、节点开始显现的延迟秒数。 */
	revealAt: number;
	/** 选中环的共享布局标识；桌面与窄屏两套轨道各用一个，互不牵连。 */
	ringId: string;
	selected: boolean;
	/** 悬停、聚焦或点击时选中本节点，详情在时间线下方展示。 */
	onSelect: () => void;
}

/** 时间线上的发布节点；选中的淡色圆盘在节点之间滑动。 */
export function HomeAccumulationPoint({
	point,
	reduceMotion,
	position,
	revealAt,
	ringId,
	selected,
	onSelect,
}: HomeAccumulationPointProps) {
	const periodLabel = formatPointPeriod(point.startsAt, point.endsAt);
	const label =
		point.items.length === 1
			? `查看发布：${point.items[0]?.title}`
			: `查看 ${periodLabel} 的 ${point.items.length} 项发布`;
	const ringSize = point.markerSize + 12;

	return (
		<motion.div
			variants={revealVariants}
			custom={reduceMotion ? 0 : revealAt}
			className={cn(
				"absolute top-1/2 -translate-x-1/2 -translate-y-1/2",
				selected ? "z-20" : "z-10",
			)}
			style={{ left: `${position}%` }}
		>
			<button
				type="button"
				aria-label={label}
				aria-pressed={selected}
				onPointerEnter={(event) => {
					if (event.pointerType === "mouse") onSelect();
				}}
				onFocus={onSelect}
				onClick={onSelect}
				className="relative flex size-7 touch-manipulation items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:size-6"
			>
				{selected && (
					<motion.span
						aria-hidden
						layoutId={ringId}
						transition={{ duration: reduceMotion ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
						style={{ width: ringSize, height: ringSize }}
						className="absolute inset-0 m-auto overflow-hidden rounded-full bg-background"
					>
						<span className="absolute inset-0 bg-primary/15" />
					</motion.span>
				)}
				<span
					aria-hidden
					style={{ width: point.markerSize, height: point.markerSize }}
					className={cn(
						"relative block rounded-full bg-muted-foreground ring-1 ring-background transition-colors duration-200",
						(point.isLatest || selected) && "bg-primary",
					)}
				/>
			</button>
		</motion.div>
	);
}
