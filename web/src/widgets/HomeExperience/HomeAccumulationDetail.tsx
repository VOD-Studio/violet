import { formatDate } from "@shared/lib/date";
import { cn } from "cn";
import { AnimatePresence, motion } from "motion/react";

import { HomeContentLink } from "./HomeContentLink";
import { type AccumulationPoint, formatPointPeriod } from "./home-accumulation-model";
import { HOME_KIND_LABEL } from "./home-content";

interface HomeAccumulationDetailProps {
	point: AccumulationPoint;
	/** 当前节点包含窗口内最新发布物。 */
	isLatest: boolean;
	latestIsToday: boolean;
	reduceMotion: boolean | null;
}

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** 时间线下方的节点详情，切换节点时整体淡入淡出，条目依次浮现。 */
export function HomeAccumulationDetail({
	point,
	isLatest,
	latestIsToday,
	reduceMotion,
}: HomeAccumulationDetailProps) {
	const tag = isLatest ? (latestIsToday ? "今日新篇" : "新篇") : null;
	return (
		<div className="min-h-36">
			<AnimatePresence mode="wait" initial={false}>
				<motion.div
					key={point.key}
					initial={reduceMotion ? false : { opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: reduceMotion ? 0 : 0.18, ease: EASE_OUT }}
				>
					<p className="flex items-center justify-center gap-2 text-xs text-muted-foreground tabular-nums">
						{tag && (
							<span className={cn("font-medium", latestIsToday && "text-primary")}>
								{tag}
							</span>
						)}
						{tag && (
							<span aria-hidden className="text-muted-foreground/40">
								·
							</span>
						)}
						<span>{formatPointPeriod(point.startsAt, point.endsAt)}</span>
						<span aria-hidden className="text-muted-foreground/40">
							·
						</span>
						<span>{point.items.length} 篇</span>
					</p>
					<ul className="mx-auto mt-3 max-h-52 max-w-md divide-y divide-border/50 overflow-y-auto overscroll-contain [scrollbar-width:none]">
						{point.items.map((item, index) => (
							<motion.li
								key={item.id}
								initial={reduceMotion ? false : { opacity: 0 }}
								animate={{ opacity: 1 }}
								transition={{
									duration: reduceMotion ? 0 : 0.3,
									delay: reduceMotion ? 0 : 0.08 + Math.min(index, 6) * 0.05,
									ease: EASE_OUT,
								}}
							>
								<HomeContentLink
									item={item}
									className="group flex items-baseline justify-between gap-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
								>
									<span className="min-w-0 truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">
										{item.title}
									</span>
									<span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
										{HOME_KIND_LABEL[item.kind]} ·{" "}
										<time dateTime={item.published_at}>
											{formatDate(item.published_at, "dotted-date")}
										</time>
									</span>
								</HomeContentLink>
							</motion.li>
						))}
					</ul>
				</motion.div>
			</AnimatePresence>
		</div>
	);
}
