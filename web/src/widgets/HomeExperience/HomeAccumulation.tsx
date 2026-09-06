import { motion, useReducedMotion } from "motion/react";

import { HomeAccumulationPoint } from "./HomeAccumulationPoint";
import { buildAccumulationTimeline } from "./home-accumulation-model";
import type { HomePublicationItem } from "./types";

interface HomeAccumulationProps {
	publications: HomePublicationItem[];
	aggregationDays: number;
}

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** 在连续时间线上呈现最近十二个月的公开发布节点。 */
export function HomeAccumulation({ publications, aggregationDays }: HomeAccumulationProps) {
	const reduceMotion = useReducedMotion();
	const { months, points, seasonLabels, latest } = buildAccumulationTimeline(
		publications,
		aggregationDays,
	);
	if (!latest || points.length === 0) return null;

	return (
		<section
			aria-labelledby="home-accumulation-title"
			className="mx-auto max-w-7xl px-5 pt-20 sm:px-8 sm:pt-24 lg:px-12 lg:pt-28"
		>
			<div className="mx-auto max-w-6xl">
				<h2
					id="home-accumulation-title"
					className="text-center text-2xl leading-loose font-medium tracking-[-0.02em]"
				>
					发布足迹
				</h2>

				<figure className="mt-6">
					<p className="sr-only">
						{months
							.map((month) => `${month.year}年${month.month}月 ${month.count} 项`)
							.join("；")}
					</p>

					<div className="mb-2 flex items-center justify-end">
						<span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
							<span className="size-1.5 rounded-full bg-primary" />
							<span className="font-medium tracking-wide text-primary">今天</span>
						</span>
					</div>

					<div className="relative h-20">
						<div className="absolute inset-x-0 top-8 h-px">
							<div aria-hidden className="absolute inset-0 bg-border/70" />
							<motion.div
								aria-hidden
								initial={reduceMotion ? false : { scaleX: 0 }}
								whileInView={{ scaleX: 1 }}
								viewport={{ once: true, amount: 0.6 }}
								transition={{ duration: reduceMotion ? 0 : 0.82, ease: EASE_OUT }}
								className="absolute inset-0 origin-left bg-foreground/30"
							/>
							{points.map((point) => (
								<HomeAccumulationPoint
									key={point.key}
									point={point}
									reduceMotion={reduceMotion}
								/>
							))}
							<span
								aria-hidden
								className="absolute top-1/2 right-0 z-10 h-3 w-px -translate-y-1/2 bg-primary/70"
							/>
						</div>

						{seasonLabels.map((season) => (
							<span
								key={season.key}
								aria-hidden
								style={{ left: `${season.position}%` }}
								className="absolute top-14 -translate-x-1/2 text-[11px] font-medium tracking-[0.18em] text-muted-foreground"
							>
								{season.label}
							</span>
						))}
					</div>
				</figure>
			</div>
		</section>
	);
}
