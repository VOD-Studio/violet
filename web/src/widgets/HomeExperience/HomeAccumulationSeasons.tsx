import { cn } from "cn";
import { motion } from "motion/react";

import { HomeAccumulationPoint } from "./HomeAccumulationPoint";
import { type AccumulationTimeline, assignPointsToSegments } from "./home-accumulation-model";
import { revealVariants } from "./home-accumulation-motion";

interface HomeAccumulationSeasonsProps {
	timeline: AccumulationTimeline;
	selectedKey: string;
	onSelect: (key: string) => void;
	reduceMotion: boolean | null;
}

const ROW_STAGGER_SECONDS = 0.14;
const ROW_DRAW_SECONDS = 0.5;
const DAY_IN_MILLISECONDS = 86_400_000;

/** 窄屏分行：每个季节一条短轴，节点密度足够点按，当前季节以主色标出。 */
export function HomeAccumulationSeasons({
	timeline,
	selectedKey,
	onSelect,
	reduceMotion,
}: HomeAccumulationSeasonsProps) {
	const { seasonSegments, points, todayAt } = timeline;
	const grouped = assignPointsToSegments(points, seasonSegments, todayAt);

	return (
		<ol className="space-y-5">
			{seasonSegments.map((segment, rowIndex) => {
				const isCurrent = todayAt >= segment.startsAt && todayAt < segment.endsAt;
				const rowDelay = rowIndex * ROW_STAGGER_SECONDS;
				const todayRatio = isCurrent
					? ((todayAt + DAY_IN_MILLISECONDS / 2 - segment.startsAt) /
							(segment.endsAt - segment.startsAt)) *
						100
					: 100;
				return (
					<li key={segment.key}>
						<motion.div
							variants={revealVariants}
							custom={reduceMotion ? 0 : rowDelay}
							className="flex items-baseline justify-between"
						>
							<p className="flex items-baseline gap-2">
								<span
									className={cn(
										"text-sm tracking-[0.18em]",
										isCurrent ? "text-primary" : "text-foreground/85",
									)}
								>
									{segment.label}
								</span>
								<span className="text-[11px] text-muted-foreground/75 tabular-nums">
									{segment.yearLabel}
								</span>
							</p>
							<span className="text-xs text-muted-foreground/75 tabular-nums">
								{segment.count} 篇
							</span>
						</motion.div>
						<div className="relative mt-1 h-7">
							<div className="absolute inset-x-0 top-1/2 h-px">
								<div
									aria-hidden
									className="absolute inset-0 bg-linear-to-r from-border/40 via-border to-border/40"
								/>
								<motion.div
									aria-hidden
									variants={{
										hidden: { scaleX: 0 },
										shown: {
											scaleX: 1,
											transition: {
												duration: ROW_DRAW_SECONDS,
												delay: rowDelay,
												ease: "linear",
											},
										},
									}}
									style={{ right: `${100 - todayRatio}%` }}
									className={cn(
										"absolute inset-y-0 left-0 origin-left",
										isCurrent
											? "bg-linear-to-r from-foreground/10 to-primary/60"
											: "bg-linear-to-r from-foreground/10 via-foreground/25 to-foreground/10",
									)}
								/>
								{isCurrent && (
									<span
										aria-hidden
										style={{ left: `${todayRatio}%` }}
										className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-primary"
									/>
								)}
								{grouped.get(segment.key)?.map(({ point, position }) => (
									<HomeAccumulationPoint
										key={point.key}
										point={point}
										position={position}
										revealAt={rowDelay + (position / 100) * ROW_DRAW_SECONDS}
										ringId="home-accumulation-ring-seasons"
										reduceMotion={reduceMotion}
										selected={selectedKey === point.key}
										onSelect={() => onSelect(point.key)}
									/>
								))}
							</div>
						</div>
					</li>
				);
			})}
		</ol>
	);
}
