import type { Announcement } from "@features/settings/model/types";
import { cn } from "@shared/lib/utils";
import { getAnnouncementSev } from "@shared/ui/announcement-severity";
import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { fmtDate, statusOf } from "../model/event";

/** 显要度：字号 / 字重 / 摘要行做层级（无卡片无 pane 尺寸） */
type Salience = "major" | "standard" | "minor";

function salienceOf(a: Announcement, status: string): Salience {
	if (
		(a.severity === "error" && status === "active") ||
		(a.severity === "warning" && (status === "active" || status === "scheduled"))
	)
		return "major";
	if (status === "ended" || a.severity === "info") return "minor";
	return "standard";
}

const TITLE = {
	major: "text-lg font-semibold tracking-tight",
	standard: "text-base font-medium",
	minor: "text-sm font-medium",
} as const;

/** 行尾状态：中文文案，不用电码 */
function RowStatus({ a, status }: { a: Announcement; status: string }) {
	if (a.display === "article") return <span className="text-muted-foreground/80">简报 →</span>;
	if (status === "scheduled")
		return <span className="text-amber-600 dark:text-amber-400">未生效</span>;
	if (status === "ended") return <span className="text-muted-foreground/60">已收档</span>;
	return <span className="text-muted-foreground">进行中</span>;
}

/**
 * 方向 F · 编辑索引（生产现役：首页 AnnouncementFeed）
 *
 * 设计意图：/lab 索引页的同款目录语言——栏头 + hairline 行条目 +
 * 序号，公告区是首页内嵌的一页目录。层级不靠卡片尺寸，靠字号 /
 * 字重 / 摘要行：故障与维护的标题更大且带一行摘要，日常信息是
 * 紧凑小字行。severity 只用色点，状态用中文。article 整行可点。
 *
 * 纯渲染组件，按传入顺序渲染（排序权威是后端返回顺序）；
 * lab 里要倒序时由调用方先 byNewest。
 */
export function EditorialIndex({ items }: { items: Announcement[] }) {
	return (
		<div>
			<div className="flex items-center justify-between border-b border-edge-hairline pb-2.5 font-mono text-[10px] tracking-[0.3em] text-muted-foreground/50 uppercase">
				<span>Announcements · {items.length}</span>
				<span>mm-dd</span>
			</div>
			<div>
				{items.map((a, i) => (
					<IndexRow key={a.id} a={a} i={i} />
				))}
			</div>
		</div>
	);
}

function IndexRow({ a, i }: { a: Announcement; i: number }) {
	const cfg = getAnnouncementSev(a.severity);
	const status = statusOf(a);
	const salience = salienceOf(a, status);
	const ended = status === "ended";
	const isArticle = a.display === "article";

	const inner = (
		<motion.div
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.3, delay: i * 0.04 }}
			className={cn(
				"grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-x-5 border-b border-edge-hairline px-2 py-3.5 transition-colors last:border-b-0",
				isArticle && "group hover:bg-muted/30",
				ended && "opacity-55",
			)}
		>
			<span className="font-mono text-sm tabular-nums text-muted-foreground/40 transition-colors group-hover:text-muted-foreground/80">
				{String(i + 1).padStart(2, "0")}
			</span>
			<span className="min-w-0">
				<span className="flex flex-wrap items-baseline gap-x-2.5">
					<span
						className={cn(
							"text-foreground",
							TITLE[salience],
							isArticle && "group-hover:underline group-hover:underline-offset-4",
						)}
					>
						{a.title}
					</span>
					<span
						className={cn(
							"size-1.5 shrink-0 translate-y-[-1px] self-center rounded-full",
							cfg.dot,
						)}
					/>
				</span>
				{salience === "major" ? (
					<span className="mt-1 block line-clamp-1 text-sm text-muted-foreground">
						{a.excerpt ?? a.content}
					</span>
				) : null}
			</span>
			<span className="flex shrink-0 items-baseline gap-3 font-mono text-[10px] tabular-nums text-muted-foreground">
				<RowStatus a={a} status={status} />
				<span className="text-muted-foreground/60">{fmtDate(a.created_at)}</span>
			</span>
		</motion.div>
	);

	return isArticle ? (
		<Link to="/announcements/$id" params={{ id: String(a.id) }} className="block">
			{inner}
		</Link>
	) : (
		inner
	);
}
