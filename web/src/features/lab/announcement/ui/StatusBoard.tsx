import type { Announcement } from "@features/settings/model/types";
import { cn } from "@shared/lib/utils";
import { getAnnouncementSev } from "@shared/ui/announcement-severity";
import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { byNewest, type EventStatus, fmtDate, fmtStamp, fmtWindow, statusOf } from "../model/event";

/** 站点总览状态：只由「进行中」公告推导，未生效的预告不算当前故障 */
function overallOf(active: Announcement[]): { sev: string; label: string } {
	if (active.some((a) => a.severity === "error")) return { sev: "error", label: "部分功能故障" };
	if (active.some((a) => a.severity === "warning"))
		return { sev: "warning", label: "维护进行中" };
	return { sev: "success", label: "系统运行正常" };
}

function StatusChip({ status, dot }: { status: EventStatus; dot: string }) {
	if (status === "active")
		return (
			<span className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
				<span className={cn("size-1.5 animate-pulse rounded-full", dot)} />
				进行中
			</span>
		);
	if (status === "scheduled")
		return <span className="font-mono text-[10px] text-muted-foreground">未生效</span>;
	return <span className="font-mono text-[10px] text-muted-foreground/70">已收档</span>;
}

/** 事件行：severity 图标 + 标题（article 可点入简报）+ 影响范围/时间副行 + 状态章 */
function EventRow({
	a,
	status,
	compact = false,
}: {
	a: Announcement;
	status: EventStatus;
	compact?: boolean;
}) {
	const cfg = getAnnouncementSev(a.severity);
	const isArticle = a.display === "article";

	const title = isArticle ? (
		<Link
			to="/announcements/$id"
			params={{ id: String(a.id) }}
			className="transition-colors hover:text-neon-blue hover:underline hover:decoration-muted-foreground/40 hover:underline-offset-4"
		>
			{a.title}
		</Link>
	) : (
		<span>{a.title}</span>
	);

	if (compact) {
		return (
			<li className="flex items-center justify-between gap-4 border-b border-edge-hairline py-2.5 last:border-b-0">
				<span className="flex min-w-0 items-center gap-2.5">
					<span className={cn("size-1.5 shrink-0 rounded-full", cfg.dot)} />
					<span className="truncate text-sm text-muted-foreground">{title}</span>
				</span>
				<span className="flex shrink-0 items-center gap-3">
					<span className="font-mono text-[10px] tabular-nums text-muted-foreground/60">
						{fmtDate(a.created_at)}
					</span>
					<StatusChip status={status} dot={cfg.dot} />
				</span>
			</li>
		);
	}

	return (
		<li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 border-b border-edge-hairline py-3.5 last:border-b-0">
			<cfg.Icon className={cn("size-4.5 shrink-0", cfg.text)} />
			<div className="min-w-0">
				<h4 className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium text-foreground">
					{title}
					{isArticle ? (
						<span className="font-mono text-[10px] font-normal text-muted-foreground/60">
							简报
						</span>
					) : null}
				</h4>
				<p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-muted-foreground">
					<span className="tabular-nums">
						{status === "scheduled" && a.start_time
							? fmtWindow(a)
							: fmtStamp(a.created_at)}
					</span>
					{a.affects?.map((m) => (
						<span key={m} className="rounded bg-muted px-1.5 py-0.5">
							{m}
						</span>
					))}
				</p>
			</div>
			<StatusChip status={status} dot={cfg.dot} />
		</li>
	);
}

function GroupTitle({ en, count }: { en: string; count: number }) {
	return (
		<p className="mt-6 mb-1 flex items-center justify-between font-mono text-[10px] tracking-[0.3em] text-muted-foreground/50 uppercase first:mt-0">
			<span>{en}</span>
			<span>{count}</span>
		</p>
	);
}

/**
 * 方向 B · 状态面板
 *
 * 设计意图：像 status page 一样先看健康再读事件——顶部总览条由
 * 「进行中」公告的最高严重度推导，下方按 进行中 / 未生效 / 已收档
 * 分组。生效窗口与影响范围第一次有了结构位置，信息最结构化的一版。
 */
export function StatusBoard({ items }: { items: Announcement[] }) {
	const now = Date.now();
	const withStatus = byNewest(items).map((a) => ({ a, status: statusOf(a, now) }));
	const active = withStatus.filter((x) => x.status === "active");
	const scheduled = withStatus.filter((x) => x.status === "scheduled");
	const ended = withStatus.filter((x) => x.status === "ended");
	const overall = overallOf(active.map((x) => x.a));
	const cfg = getAnnouncementSev(overall.sev);

	return (
		<motion.div
			initial={{ opacity: 0, y: 12 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.4 }}
		>
			<div
				className={cn(
					"flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-edge-hairline px-5 py-4",
					cfg.badge,
				)}
			>
				<span className="flex items-center gap-3">
					<cfg.Icon className="size-5 shrink-0" />
					<span className="text-base font-semibold">{overall.label}</span>
				</span>
				<span className="font-mono text-[11px] tracking-wider opacity-80">
					{active.length} 进行中 · {scheduled.length} 未生效 · {ended.length} 已收档
				</span>
			</div>

			<GroupTitle en="In Progress" count={active.length} />
			<ul>
				{active.map(({ a, status }) => (
					<EventRow key={a.id} a={a} status={status} />
				))}
			</ul>

			{scheduled.length > 0 ? (
				<>
					<GroupTitle en="Scheduled" count={scheduled.length} />
					<ul>
						{scheduled.map(({ a, status }) => (
							<EventRow key={a.id} a={a} status={status} />
						))}
					</ul>
				</>
			) : null}

			{ended.length > 0 ? (
				<>
					<GroupTitle en="Ended" count={ended.length} />
					<ul>
						{ended.map(({ a, status }) => (
							<EventRow key={a.id} a={a} status={status} compact />
						))}
					</ul>
				</>
			) : null}
		</motion.div>
	);
}
