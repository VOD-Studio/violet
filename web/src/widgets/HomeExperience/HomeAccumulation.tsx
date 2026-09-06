import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";

import { HomeAccumulationPoint } from "./HomeAccumulationPoint";
import { HomeContentLink } from "./HomeContentLink";
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

	const latestYear = new Date(latest.publishedAt).getFullYear();
	const yearCount = publications.filter((p) => {
		const d = new Date(p.publishedAt);
		return !Number.isNaN(d.getTime()) && d.getFullYear() === latestYear;
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
					笔耕不辍
				</h2>
				<figure className="mt-6">
					<p className="sr-only">
						{months
							.map((month) => `${month.year}年${month.month}月 ${month.count} 项`)
							.join("；")}
					</p>

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
							{/* 右侧终点红色刻度线与上方的“今” */}
							<div className="absolute top-1/2 right-0 z-10 -translate-y-1/2">
								<span
									aria-hidden
									className="absolute -top-4 -right-1 text-[11px] font-medium text-primary"
								>
									今
								</span>
								<span aria-hidden className="block h-3.5 w-px bg-primary" />
							</div>
						</div>

						{seasonLabels.map((season) => (
							<span
								key={season.key}
								aria-hidden
								style={{ left: `${season.position}%` }}
								className="absolute top-14 -translate-x-1/2 text-[11px] font-medium tracking-[0.18em] text-muted-foreground/75"
							>
								{season.label}
							</span>
						))}
					</div>

					{/* 时间线下方居中引导：近作与完整时间线 */}
					<div className="mt-8 space-y-2 text-center">
						<div className="flex min-w-0 items-baseline justify-center gap-2 text-sm text-foreground/80">
							<span className="shrink-0 text-muted-foreground">近作 ·</span>
							<HomeContentLink
								item={latest}
								className="min-w-0 truncate font-medium text-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
							>
								{latest.title}
							</HomeContentLink>
						</div>
						<div className="flex items-center justify-center gap-1.5 text-xs">
							<span className="text-muted-foreground/70 italic">
								本年 {yearCount} 篇 ·
							</span>
							<Link
								to="/blog/archive"
								className="inline-flex items-center gap-1 font-medium text-primary transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
							>
								翻阅完整时间线 →
							</Link>
						</div>
					</div>
				</figure>
			</div>
		</section>
	);
}
