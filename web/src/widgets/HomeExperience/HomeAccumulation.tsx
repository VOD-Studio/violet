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
					积微成著
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

						{/* 星尘微尘：浅金琥珀色微晶粒，散落于时间线四周衬托诗意 */}
						<div aria-hidden className="pointer-events-none absolute inset-0">
							<svg
								aria-hidden="true"
								className="absolute -top-3 left-[15%] size-3 text-amber-500/40 dark:text-amber-300/35"
								viewBox="0 0 24 24"
								fill="currentColor"
							>
								<path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" />
							</svg>
							<span className="absolute top-12 left-[32%] size-1.5 rotate-45 bg-amber-500/25 dark:bg-amber-300/20" />
							<span className="absolute -top-1 right-[26%] h-px w-5 bg-amber-500/30 dark:bg-amber-300/25" />
							<svg
								aria-hidden="true"
								className="absolute top-2 right-[10%] size-2.5 text-amber-500/35 dark:text-amber-300/30"
								viewBox="0 0 24 24"
								fill="currentColor"
							>
								<path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" />
							</svg>
							<span className="absolute top-14 left-[64%] size-1 rotate-45 bg-amber-500/35 dark:bg-amber-300/30" />
							<svg
								aria-hidden="true"
								className="absolute bottom-2 left-[5%] size-2 text-amber-500/30 dark:text-amber-300/25"
								viewBox="0 0 24 24"
								fill="currentColor"
							>
								<path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" />
							</svg>
							<span className="absolute -bottom-1 right-[18%] size-1.5 rotate-45 bg-amber-500/25 dark:bg-amber-300/20" />
						</div>
					</div>

					{/* 时间线下方居中引导：新篇与年表入口（采用自然比例无衬线字体与优雅衬线斜体） */}
					<div className="mt-7 space-y-1.5 text-center font-[system-ui,-apple-system,'PingFang_SC','Noto_Sans_SC','Microsoft_YaHei',sans-serif]">
						<div className="flex min-w-0 items-baseline justify-center gap-1.5 text-[13.5px] text-foreground/85">
							<span className="shrink-0 text-muted-foreground/75">新篇 ·</span>
							<HomeContentLink
								item={latest}
								className="min-w-0 truncate font-medium text-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
							>
								{latest.title}
							</HomeContentLink>
						</div>
						<p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground/75">
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
					</div>
				</figure>
			</div>
		</section>
	);
}
