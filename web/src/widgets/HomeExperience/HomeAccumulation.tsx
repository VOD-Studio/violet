import { motion } from "motion/react";

import { HomeContentLink } from "./HomeContentLink";
import type { HomePublicationItem } from "./types";

interface HomeAccumulationProps {
	publications: HomePublicationItem[];
}

interface MonthBucket {
	key: string;
	label: string;
	year: number;
	items: HomePublicationItem[];
}

/** 用最近十二个月的真实发布绘制轻量时间轴。 */
export function HomeAccumulation({ publications }: HomeAccumulationProps) {
	if (publications.length === 0) return null;
	const months = buildMonthBuckets(publications);

	return (
		<section className="mx-auto max-w-7xl px-5 pt-28 sm:px-8 lg:px-12 lg:pt-36">
			<motion.div
				initial={false}
				whileInView={{ opacity: 1, y: 0 }}
				viewport={{ once: true, amount: 0.3 }}
				transition={{ type: "spring", stiffness: 130, damping: 22, mass: 0.9 }}
			>
				<h2 className="text-center text-2xl font-medium tracking-[-0.02em]">发布足迹</h2>
				<p className="mt-3 text-center text-sm text-muted-foreground">
					最近十二个月公开内容的时间分布
				</p>
				<div className="mt-12 overflow-x-auto pb-5">
					<div className="relative mx-auto min-w-192 max-w-6xl px-4 pt-5">
						<div
							aria-hidden
							className="absolute right-4 bottom-7 left-4 h-px bg-primary/55"
						/>
						<ol className="grid grid-cols-12">
							{months.map((month, monthIndex) => (
								<li
									key={month.key}
									className="relative flex min-h-32 flex-col items-center justify-end"
								>
									<div className="mb-3 flex min-h-20 flex-col-reverse items-center justify-start gap-1.5">
										{month.items.slice(0, 6).map((item, itemIndex) => (
											<motion.div
												key={item.key}
												initial={false}
												whileInView={{ opacity: 1, y: 0 }}
												viewport={{ once: true }}
												transition={{
													type: "spring",
													stiffness: 150,
													damping: 18,
													delay: monthIndex * 0.025 + itemIndex * 0.035,
												}}
											>
												<HomeContentLink
													item={item}
													className="group flex size-2.5 rounded-full bg-primary/70 ring-4 ring-background transition-[transform,background-color] hover:scale-150 hover:bg-primary focus-visible:scale-150 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary motion-reduce:transition-none"
												>
													<span className="sr-only">{item.title}</span>
												</HomeContentLink>
											</motion.div>
										))}
									</div>
									<span
										aria-hidden
										className="relative z-10 size-2 rounded-full bg-primary"
									/>
									<span className="mt-3 text-xs text-muted-foreground tabular-nums">
										{month.label}
									</span>
								</li>
							))}
						</ol>
						<div className="mt-2 flex justify-between px-1 text-xs text-muted-foreground tabular-nums">
							<span>{months[0]?.year}</span>
							<span>{months.at(-1)?.year}</span>
						</div>
					</div>
				</div>
			</motion.div>
		</section>
	);
}

function buildMonthBuckets(publications: HomePublicationItem[]): MonthBucket[] {
	const newestDate = new Date(publications[0]?.publishedAt ?? Date.now());
	const anchor = Number.isNaN(newestDate.getTime()) ? new Date() : newestDate;
	const months: MonthBucket[] = Array.from({ length: 12 }, (_, index) => {
		const date = new Date(anchor.getFullYear(), anchor.getMonth() - (11 - index), 1);
		return {
			key: `${date.getFullYear()}-${date.getMonth() + 1}`,
			label: `${date.getMonth() + 1}月`,
			year: date.getFullYear(),
			items: [],
		};
	});
	const monthByKey = new Map(months.map((month) => [month.key, month]));

	for (const publication of publications) {
		const date = new Date(publication.publishedAt);
		if (Number.isNaN(date.getTime())) continue;
		monthByKey.get(`${date.getFullYear()}-${date.getMonth() + 1}`)?.items.push(publication);
	}

	return months;
}
