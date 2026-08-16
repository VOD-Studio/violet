import type { Announcement } from "@features/settings/model/types";
import { cn } from "@shared/lib/utils";
import { getAnnouncementSev } from "@shared/ui/announcement-severity";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { byNewest, fmtStamp, SEV_CODE, statusOf } from "../model/mock";

/** 生命周期 → 行尾注记；进行中不占位 */
const TAIL_MARK = { scheduled: "未生效", ended: "已收档" } as const;

/** 进行中的 warning / error 压左侧色边线，其余 severity 不压线 */
function edgeClass(a: Announcement, status: string): string {
	if (status !== "active") return "border-l-transparent";
	if (a.severity === "error") return "border-l-red-500";
	if (a.severity === "warning") return "border-l-amber-500";
	return "border-l-transparent";
}

/**
 * 方向 A · 事件日志
 *
 * 设计意图：公告是站点的运营日志——倒序事件流一行一条，
 * mono 时间戳 + 三字母电码 + severity 色点，进行中的故障与维护
 * 压左侧色边线。占地最小、密度最高，三个方向里最安静的一版。
 * article 形态整行可点入简报，card 形态读完即止。
 */
export function EventLog({ items }: { items: Announcement[] }) {
	const feed = byNewest(items);

	return (
		<div>
			<div className="mb-1 flex items-center justify-between border-b border-edge-hairline pb-2.5 font-mono text-[10px] tracking-[0.3em] text-muted-foreground/50 uppercase">
				<span>Site Log · {feed.length} events</span>
				<span>Updated {fmtStamp(feed[0].created_at)}</span>
			</div>
			<ul>
				{feed.map((a, i) => {
					const cfg = getAnnouncementSev(a.severity);
					const status = statusOf(a);
					const isArticle = a.display === "article";
					const ended = status === "ended";

					const row = (
						<span
							className={cn(
								"grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-x-4 border-l-2 px-3 py-3 transition-colors duration-200",
								edgeClass(a, status),
								isArticle && "group-hover:bg-muted/40",
								ended && "opacity-55",
							)}
						>
							<span className="font-mono text-[11px] tabular-nums text-muted-foreground">
								{fmtStamp(a.created_at)}
							</span>
							<span className="flex w-15 items-center gap-1.5">
								<span className={cn("size-1.5 shrink-0 rounded-full", cfg.dot)} />
								<span
									className={cn(
										"font-mono text-[10px] font-medium tracking-widest",
										cfg.text,
									)}
								>
									{SEV_CODE[a.severity]}
								</span>
							</span>
							<span className="truncate text-sm text-foreground">{a.title}</span>
							{isArticle ? (
								<ArrowRight className="size-3.5 text-muted-foreground/50 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-foreground" />
							) : status !== "active" ? (
								<span className="font-mono text-[10px] text-muted-foreground/60">
									{TAIL_MARK[status]}
								</span>
							) : null}
						</span>
					);

					return (
						<motion.li
							key={a.id}
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.3, delay: i * 0.04 }}
							className="border-b border-edge-hairline last:border-b-0"
						>
							{isArticle ? (
								<Link
									to="/announcements/$id"
									params={{ id: String(a.id) }}
									className="group block"
								>
									{row}
								</Link>
							) : (
								row
							)}
						</motion.li>
					);
				})}
			</ul>
		</div>
	);
}
