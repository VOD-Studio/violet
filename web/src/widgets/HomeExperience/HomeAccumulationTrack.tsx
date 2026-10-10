import { cn } from "cn";
import { motion } from "motion/react";

import { HomeAccumulationPoint } from "./HomeAccumulationPoint";
import type { AccumulationMonth, AccumulationTimeline } from "./home-accumulation-model";
import { LINE_DRAW_SECONDS, revealDelay, revealVariants } from "./home-accumulation-motion";

interface HomeAccumulationTrackProps {
	timeline: AccumulationTimeline;
	selectedKey: string;
	onSelect: (key: string) => void;
	reduceMotion: boolean | null;
}

/** 宽屏单轴：十二个月连续铺开，节点与季节随线条依次显现。 */
export function HomeAccumulationTrack({
	timeline,
	selectedKey,
	onSelect,
	reduceMotion,
}: HomeAccumulationTrackProps) {
	const { months, points, seasonLabels, todayPosition } = timeline;
	const monthTicks = buildMonthTicks(months);
	const hasTodayPoint = points.some((point) => point.includesToday);

	return (
		<div className="relative h-16">
			<div className="absolute inset-x-0 top-6 h-px">
				<div
					aria-hidden
					className="absolute inset-0 bg-linear-to-r from-transparent via-border to-border/30"
				/>
				<motion.div
					aria-hidden
					variants={{
						hidden: { scaleX: 0 },
						shown: {
							scaleX: 1,
							transition: { duration: LINE_DRAW_SECONDS, ease: "linear" },
						},
					}}
					style={{ right: `${100 - todayPosition}%` }}
					className="absolute inset-y-0 left-0 origin-left bg-linear-to-r from-transparent via-foreground/25 to-primary/60"
				/>
				{monthTicks.map(({ position, year }) => (
					<motion.span
						key={position}
						aria-hidden
						variants={revealVariants}
						custom={reduceMotion ? 0 : revealDelay(position, todayPosition)}
						style={{ left: `${position}%` }}
						className={cn(
							"absolute top-0 w-px -translate-y-1/2 bg-border",
							year ? "h-3" : "h-1.5",
						)}
					>
						{year && (
							<span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground/60 tabular-nums">
								{year}
							</span>
						)}
					</motion.span>
				))}
				{points.map((point) => (
					<HomeAccumulationPoint
						key={point.key}
						point={point}
						position={point.position}
						revealAt={revealDelay(point.position, todayPosition)}
						ringId="home-accumulation-ring"
						reduceMotion={reduceMotion}
						selected={selectedKey === point.key}
						onSelect={() => onSelect(point.key)}
					/>
				))}
				<motion.div
					variants={revealVariants}
					custom={reduceMotion ? 0 : LINE_DRAW_SECONDS}
					style={{ left: `${todayPosition}%` }}
					className="absolute top-1/2 z-0 -translate-x-1/2 -translate-y-1/2"
				>
					<span
						aria-hidden
						className={cn(
							"absolute left-1/2 -translate-x-1/2 text-[11px] font-medium text-primary",
							hasTodayPoint ? "-top-5.5" : "-top-4",
						)}
					>
						今
					</span>
					{!hasTodayPoint && <span aria-hidden className="block h-3.5 w-px bg-primary" />}
				</motion.div>
			</div>

			{seasonLabels.map((season) => (
				<motion.span
					key={season.key}
					aria-hidden
					variants={revealVariants}
					custom={reduceMotion ? 0 : revealDelay(season.position, todayPosition)}
					style={{ left: `${season.position}%` }}
					className="absolute top-11 -translate-x-1/2 text-[11px] font-medium tracking-[0.18em] text-muted-foreground/75"
				>
					{season.label}
				</motion.span>
			))}
		</div>
	);
}

/** 各月起点（不含首月）在时间线上的百分比位置；一月刻度带年份。 */
function buildMonthTicks(months: AccumulationMonth[]): { position: number; year: number | null }[] {
	const first = months[0];
	const last = months.at(-1);
	if (!first || !last) return [];
	const end = Date.UTC(last.year, last.month, 1);
	return months.slice(1).map((month) => ({
		position: ((month.startsAt - first.startsAt) / (end - first.startsAt)) * 100,
		year: month.month === 1 ? month.year : null,
	}));
}
