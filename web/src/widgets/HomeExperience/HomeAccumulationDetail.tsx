import { formatDate } from "@shared/lib/date";
import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { AnimatePresence, motion } from "motion/react";

import { HomeContentLink } from "./HomeContentLink";
import { type AccumulationPoint, formatPointPeriod } from "./home-accumulation-model";
import { HOME_KIND_LABEL } from "./home-content";
import type { HomePublicationItem } from "./types";

interface HomeAccumulationDetailProps {
	point: AccumulationPoint;
	/** 当前节点包含窗口内最新发布物。 */
	isLatest: boolean;
	latestIsToday: boolean;
	reduceMotion: boolean | null;
}

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
/** 宽屏横向最多并排的条目数，超出以「另 N 篇」收束。 */
const WIDE_ITEM_LIMIT = 3;

/**
 * 时间线下方的节点详情，切换节点时整体淡入淡出，条目依次浮现。
 *
 * @remarks 容器高度固定，窄屏为纵向列表（区内滚动），宽屏为并排条目，切换节点不引起页面布局跳动。
 */
export function HomeAccumulationDetail({
	point,
	isLatest,
	latestIsToday,
	reduceMotion,
}: HomeAccumulationDetailProps) {
	const tag = isLatest ? (latestIsToday ? "今日新篇" : "新篇") : null;
	const many = point.items.length > 1;
	const period = formatPointPeriod(point.startsAt, point.endsAt);
	const meta = [many || !tag ? period : null, many ? `${point.items.length} 篇` : null].filter(
		Boolean,
	);
	const wideItems = point.items.slice(0, WIDE_ITEM_LIMIT);
	const hiddenCount = point.items.length - wideItems.length;

	return (
		<div className="h-44 sm:h-32">
			<AnimatePresence mode="wait" initial={false}>
				<motion.div
					key={point.key}
					className="flex h-full flex-col"
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
						{meta.map((text) => (
							<span key={text} className="flex items-center gap-2">
								{tag || text !== meta[0] ? (
									<span aria-hidden className="text-muted-foreground/40">
										·
									</span>
								) : null}
								{text}
							</span>
						))}
					</p>

					<ul className="mx-auto mt-3 min-h-0 w-full max-w-md flex-1 divide-y divide-border/50 overflow-y-auto overscroll-contain [scrollbar-width:none] sm:hidden">
						{point.items.map((item, index) => (
							<motion.li key={item.id} {...reveal(index, reduceMotion)}>
								<HomeContentLink
									item={item}
									className="group flex items-baseline justify-between gap-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
								>
									<span className="min-w-0 truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">
										{item.title}
									</span>
									<ItemMeta item={item} />
								</HomeContentLink>
							</motion.li>
						))}
					</ul>

					<ul className="mx-auto mt-5 hidden w-full max-w-4xl flex-1 grid-flow-col auto-cols-fr divide-x divide-border/60 sm:grid">
						{wideItems.map((item, index) => (
							<motion.li
								key={item.id}
								{...reveal(index, reduceMotion)}
								className="min-w-0 px-8 first:pl-0 last:pr-0"
							>
								<HomeContentLink
									item={item}
									className="group flex flex-col items-center gap-2 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
								>
									<ItemMeta item={item} />
									<span className="line-clamp-2 text-[15px] leading-6 font-medium text-foreground transition-colors group-hover:text-primary">
										{item.title}
									</span>
								</HomeContentLink>
							</motion.li>
						))}
						{hiddenCount > 0 && (
							<motion.li
								{...reveal(wideItems.length, reduceMotion)}
								className="flex min-w-0 items-center justify-center px-8 last:pr-0"
							>
								<Link
									to="/blog/archive"
									className="text-xs text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
								>
									另 {hiddenCount} 篇 →
								</Link>
							</motion.li>
						)}
					</ul>
				</motion.div>
			</AnimatePresence>
		</div>
	);
}

function ItemMeta({ item }: { item: HomePublicationItem }) {
	return (
		<span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
			{HOME_KIND_LABEL[item.kind]} ·{" "}
			<time dateTime={item.published_at}>{formatDate(item.published_at, "dotted-date")}</time>
		</span>
	);
}

function reveal(index: number, reduceMotion: boolean | null) {
	return {
		initial: reduceMotion ? (false as const) : { opacity: 0 },
		animate: { opacity: 1 },
		transition: {
			duration: reduceMotion ? 0 : 0.3,
			delay: reduceMotion ? 0 : 0.08 + Math.min(index, 6) * 0.05,
			ease: EASE_OUT,
		},
	};
}
