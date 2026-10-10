import { cn } from "cn";
import { motion } from "motion/react";

import { type AccumulationPoint, formatPointPeriod } from "./home-accumulation-model";
import { revealDelay, revealVariants } from "./home-accumulation-motion";

interface HomeAccumulationPointProps {
	point: AccumulationPoint;
	reduceMotion: boolean | null;
	/** 轴线终点位置，用于换算随线条显现的延迟。 */
	todayPosition: number;
	selected: boolean;
	/** 悬停、聚焦或点击时选中本节点，详情在时间线下方展示。 */
	onSelect: () => void;
}

/** 时间线上的发布节点；选中描边环在节点之间滑动。 */
export function HomeAccumulationPoint({
	point,
	reduceMotion,
	todayPosition,
	selected,
	onSelect,
}: HomeAccumulationPointProps) {
	const periodLabel = formatPointPeriod(point.startsAt, point.endsAt);
	const label =
		point.items.length === 1
			? `查看发布：${point.items[0]?.title}`
			: `查看 ${periodLabel} 的 ${point.items.length} 项发布`;
	const ringSize = point.markerSize + 10;

	return (
		<motion.div
			variants={revealVariants}
			custom={reduceMotion ? 0 : revealDelay(point.position, todayPosition)}
			className={cn(
				"absolute top-1/2 -translate-x-1/2 -translate-y-1/2",
				selected ? "z-20" : "z-10",
			)}
			style={{ left: `${point.position}%` }}
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
				className="relative flex size-8 touch-manipulation items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:size-6"
			>
				{selected && (
					<motion.span
						aria-hidden
						layoutId="home-accumulation-ring"
						transition={{ duration: reduceMotion ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
						style={{ width: ringSize, height: ringSize }}
						className="absolute inset-0 m-auto rounded-full ring-1 ring-primary/50"
					/>
				)}
				<span
					aria-hidden
					style={{ width: point.markerSize, height: point.markerSize }}
					className={cn(
						"block rounded-full bg-muted-foreground ring-1 ring-background transition-colors duration-200",
						(point.isLatest || selected) && "bg-primary",
					)}
				/>
			</button>
		</motion.div>
	);
}
