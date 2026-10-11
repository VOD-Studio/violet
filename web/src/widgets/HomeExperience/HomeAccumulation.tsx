import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";

import { HomeAccumulationDetail } from "./HomeAccumulationDetail";
import { HomeAccumulationSeasons } from "./HomeAccumulationSeasons";
import { HomeAccumulationTrack } from "./HomeAccumulationTrack";
import { buildAccumulationTimeline } from "./home-accumulation-model";
import type { HomePublicationItem } from "./types";

interface HomeAccumulationProps {
	publications: HomePublicationItem[];
	aggregationDays: number;
}

/** 呈现最近十二个月的公开发布节点：宽屏单轴，窄屏按季节分行。 */
export function HomeAccumulation({ publications, aggregationDays }: HomeAccumulationProps) {
	const reduceMotion = useReducedMotion();
	const [selectedKey, setSelectedKey] = useState<string | null>(null);
	const timeline = buildAccumulationTimeline(publications, aggregationDays);
	const { months, points, latest, latestIsToday } = timeline;
	if (!latest || points.length === 0) return null;

	const latestPoint = points.find((point) => point.isLatest) ?? points[points.length - 1];
	const selectedPoint = points.find((point) => point.key === selectedKey) ?? latestPoint;
	if (!selectedPoint) return null;

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
				<figure className="mt-10 sm:mt-14">
					<p className="sr-only">
						{months
							.map((month) => `${month.year}年${month.month}月 ${month.count} 项`)
							.join("；")}
					</p>

					<motion.div
						initial={reduceMotion ? "shown" : "hidden"}
						whileInView="shown"
						viewport={{ once: true, amount: 0.3 }}
					>
						<div className="hidden sm:block">
							<HomeAccumulationTrack
								timeline={timeline}
								selectedKey={selectedPoint.key}
								onSelect={setSelectedKey}
								reduceMotion={reduceMotion}
							/>
						</div>
						<div className="sm:hidden">
							<HomeAccumulationSeasons
								timeline={timeline}
								selectedKey={selectedPoint.key}
								onSelect={setSelectedKey}
								reduceMotion={reduceMotion}
							/>
						</div>
					</motion.div>

					<div className="mt-8 sm:mt-9">
						<HomeAccumulationDetail
							point={selectedPoint}
							isLatest={selectedPoint.isLatest}
							latestIsToday={latestIsToday}
							reduceMotion={reduceMotion}
						/>
					</div>
					<p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground/75">
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
