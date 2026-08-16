import type { Announcement } from "@features/settings/model/types";
import { cn } from "@shared/lib/utils";
import { getAnnouncementSev } from "@shared/ui/announcement-severity";
import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { fmtDate } from "../model/event";

function TickerItem({ a }: { a: Announcement }) {
	const cfg = getAnnouncementSev(a.severity);
	const inner = (
		<span className="flex shrink-0 items-center gap-2.5 whitespace-nowrap">
			<span className={cn("size-1.5 rounded-full", cfg.dot)} />
			<span
				className={cn(
					"text-sm text-foreground",
					a.display === "article" &&
						"group-hover:underline group-hover:underline-offset-4",
				)}
			>
				{a.title}
			</span>
			<span className="font-mono text-[10px] tabular-nums text-muted-foreground/50">
				{fmtDate(a.created_at)}
			</span>
		</span>
	);
	return a.display === "article" ? (
		<Link to="/announcements/$id" params={{ id: String(a.id) }} className="group flex shrink-0">
			{inner}
		</Link>
	) : (
		inner
	);
}

/**
 * 方向 D · 速览带
 *
 * 设计意图：公告不值得一块版面——全部公告压成一条横向无缝滚动的
 * 速览带（色点 + 标题 + 日期），hover 停下细看，article 可点入简报。
 * 占地最极端的一版：一条带子滚完所有运营事件。reduced-motion 下
 * 降级为静态截断（motion-safe 前缀），排序权威是传入顺序。
 */
export function Ticker({ items }: { items: Announcement[] }) {
	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			transition={{ duration: 0.4 }}
			className="group flex items-stretch border-y border-edge-hairline"
		>
			<span className="flex shrink-0 items-center border-r border-edge-hairline px-4 font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase">
				Notice
			</span>
			<div className="relative flex-1 overflow-hidden py-3">
				<div className="flex w-max gap-12 pl-6 motion-safe:group-hover:[animation-play-state:paused] motion-safe:animate-marquee">
					{[...items, ...items].map((a, i) => (
						// 第二遍内容仅用于无缝衔接，key 加 clone 区分
						<TickerItem key={`${a.id}-${i < items.length ? "a" : "b"}`} a={a} />
					))}
				</div>
			</div>
		</motion.div>
	);
}
