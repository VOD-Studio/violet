import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { motion, useReducedMotion } from "motion/react";
import { useLayoutEffect, useRef, useState } from "react";

import { HomeAccumulationDetail } from "./HomeAccumulationDetail";
import { HomeAccumulationPoint } from "./HomeAccumulationPoint";
import { type AccumulationMonth, buildAccumulationTimeline } from "./home-accumulation-model";
import { LINE_DRAW_SECONDS, revealDelay, revealVariants } from "./home-accumulation-motion";
import type { HomePublicationItem } from "./types";

interface HomeAccumulationProps {
	publications: HomePublicationItem[];
	aggregationDays: number;
}

/** 在连续时间线上呈现最近十二个月的公开发布节点。 */
export function HomeAccumulation({ publications, aggregationDays }: HomeAccumulationProps) {
	const reduceMotion = useReducedMotion();
	const [selectedKey, setSelectedKey] = useState<string | null>(null);
	const scrollerRef = useRef<HTMLDivElement>(null);
	// 窄屏时间线可横向滑动，初始停在「今」一端
	useLayoutEffect(() => {
		const scroller = scrollerRef.current;
		if (scroller) scroller.scrollLeft = scroller.scrollWidth;
	}, []);
	const { months, points, seasonLabels, latest, todayPosition, latestIsToday } =
		buildAccumulationTimeline(publications, aggregationDays);
	if (!latest || points.length === 0) return null;

	const latestPoint = points.find((point) => point.isLatest) ?? points[points.length - 1];
	const selectedPoint = points.find((point) => point.key === selectedKey) ?? latestPoint;

	const monthTicks = buildMonthTicks(months);
	const hasTodayPoint = points.some((point) => point.includesToday);
	const currentYear = new Date().getFullYear();
	const yearCount = publications.filter((publication) => {
		const publishedAt = new Date(publication.published_at);
		return !Number.isNaN(publishedAt.getTime()) && publishedAt.getFullYear() === currentYear;
	}).length;
	return (
		<section
			aria-labelledby="home-accumulation-title"
			className="mx-auto max-w-7xl px-5 pt-20 sm:px-8 sm:pt-24 lg:px-12 lg:pt-28"
		>
			<div className="mx-auto max-w-6xl">
				<h2
					id="home-accumulation-title"
					className="text-center text-2xl font-normal tracking-[0.08em] text-foreground/90 sm:text-3xl"
				>
					积微成著
				</h2>
				<figure className="mt-10 sm:mt-12">
					<p className="sr-only">
						{months
							.map((month) => `${month.year}年${month.month}月 ${month.count} 项`)
							.join("；")}
					</p>

					<motion.div
						initial={reduceMotion ? "shown" : "hidden"}
						whileInView="shown"
						viewport={{ once: true, amount: 0.6 }}
					>
						<div
							ref={scrollerRef}
							className="-mx-5 overflow-x-auto px-5 [scrollbar-width:none] max-sm:[mask-image:linear-gradient(to_right,transparent,black_1.5rem,black_calc(100%-1rem),transparent)] sm:mx-0 sm:px-0 sm:overflow-visible [&::-webkit-scrollbar]:hidden"
						>
							<div className="relative h-20 min-w-160 sm:min-w-0">
								<div className="absolute inset-x-0 top-8 h-px">
									<div
										aria-hidden
										style={{ right: `${100 - todayPosition}%` }}
										className="absolute inset-y-0 left-0 bg-border/70"
									/>
									<motion.div
										aria-hidden
										variants={{
											hidden: { scaleX: 0 },
											shown: {
												scaleX: 1,
												transition: {
													duration: LINE_DRAW_SECONDS,
													ease: "linear",
												},
											},
										}}
										style={{ right: `${100 - todayPosition}%` }}
										className="absolute inset-y-0 left-0 origin-left bg-foreground/30"
									/>
									{monthTicks.map((position) => (
										<motion.span
											key={position}
											aria-hidden
											variants={revealVariants}
											custom={
												reduceMotion
													? 0
													: revealDelay(position, todayPosition)
											}
											style={{ left: `${position}%` }}
											className="absolute top-0 h-1.5 w-px -translate-y-1/2 bg-border"
										/>
									))}
									{points.map((point) => (
										<HomeAccumulationPoint
											key={point.key}
											point={point}
											reduceMotion={reduceMotion}
											todayPosition={todayPosition}
											selected={selectedPoint?.key === point.key}
											onSelect={() => setSelectedKey(point.key)}
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
												hasTodayPoint ? "-top-6" : "-top-4",
											)}
										>
											今
										</span>
										{!hasTodayPoint && (
											<span
												aria-hidden
												className="block h-3.5 w-px bg-primary"
											/>
										)}
									</motion.div>
								</div>

								{seasonLabels.map((season) => (
									<motion.span
										key={season.key}
										aria-hidden
										variants={revealVariants}
										custom={
											reduceMotion
												? 0
												: revealDelay(season.position, todayPosition)
										}
										style={{ left: `${season.position}%` }}
										className="absolute top-14 -translate-x-1/2 text-[11px] font-medium tracking-[0.18em] text-muted-foreground/75"
									>
										{season.label}
									</motion.span>
								))}
							</div>
						</div>
					</motion.div>

					{selectedPoint && (
						<div className="mt-8 sm:mt-10">
							<HomeAccumulationDetail
								point={selectedPoint}
								isLatest={selectedPoint.isLatest}
								latestIsToday={latestIsToday}
								reduceMotion={reduceMotion}
							/>
						</div>
					)}
					<p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground/75">
						<span className="font-serif text-[13px] italic text-muted-foreground/80">
							今年落笔 {yearCount} 篇
						</span>
						<span aria-hidden className="text-muted-foreground/40">
							·
						</span>
						<Link
							to="/blog/archive"
							className="font-medium text-primary transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
						>
							尽览年表 →
						</Link>
					</p>
				</figure>
			</div>
		</section>
	);
}

/** 各月起点（不含首月）在时间线上的百分比位置。 */
function buildMonthTicks(months: AccumulationMonth[]): number[] {
	const first = months[0];
	const last = months.at(-1);
	if (!first || !last) return [];
	const end = Date.UTC(last.year, last.month, 1);
	return months
		.slice(1)
		.map((month) => ((month.startsAt - first.startsAt) / (end - first.startsAt)) * 100);
}
