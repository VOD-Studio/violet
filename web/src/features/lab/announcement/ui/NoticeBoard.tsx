import type { Announcement } from "@features/settings/model/types";
import { cn } from "@shared/lib/utils";
import { getAnnouncementSev } from "@shared/ui/announcement-severity";
import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { byNewest, fmtDate, fmtStamp, statusOf } from "../model/event";

/** 显要度：severity 与生命周期共同决定纸张大小 */
type Salience = "major" | "standard" | "minor";

/** active error/warning（正在发生的故障与维护）与 scheduled warning
 * （未生效的维护预告）都钉整栏大告示——布告栏里预告与通报同样显眼；
 * ended 与 info 是便条，success 是半栏中告示 */
function salienceOf(a: Announcement, status: string): Salience {
	if (
		(a.severity === "error" && status === "active") ||
		(a.severity === "warning" && (status === "active" || status === "scheduled"))
	)
		return "major";
	if (status === "ended" || a.severity === "info") return "minor";
	return "standard";
}

/** severity → 布告语汇（区别于系统语汇「警告/成功」：布告栏贴的是
 * 通知 / 维护 / 发布 / 故障） */
const BULLETIN_LABEL: Record<string, string> = {
	info: "通知",
	warning: "维护",
	success: "发布",
	error: "故障",
};

const SPAN = {
	major: "md:col-span-6",
	standard: "md:col-span-3",
	// 半宽而非 1/3：单行便条在 1/3 宽里太空，且 6|6|3+3|3+3 排满
	// 网格不留尾部碎片
	minor: "md:col-span-3",
} as const;

const PAD = {
	major: "p-6",
	standard: "p-5",
	minor: "px-5 py-3.5",
} as const;

/** 非大告示的微旋转错落；大告示保持端正压场 */
const TILTS = ["-rotate-1", "rotate-1", "-rotate-2", "rotate-2"];

/** 图钉：大告示两枚钉住左右 1/4（大纸单钉不稳的物理直觉），其余一枚居中 */
function Pins({ sev, double }: { sev: string; double?: boolean }) {
	const cfg = getAnnouncementSev(sev);
	const pin = (extra: string) => (
		<span
			aria-hidden
			className={cn(
				"absolute -top-1.5 size-3 rounded-full ring-2 ring-background",
				cfg.dot,
				extra,
			)}
		/>
	);
	if (double)
		return (
			<>
				{pin("left-1/4")}
				{pin("left-3/4")}
			</>
		);
	return pin("left-1/2 -translate-x-1/2");
}

/**
 * 方向 C · 告示板
 *
 * 设计意图：布告栏的显要度语法——severity 与生命周期决定纸张大小：
 * 进行中的故障与未生效的维护预告是整栏大告示（两枚图钉），发布动态
 * 是半栏中告示，日常信息与已收档是半栏便条。图钉颜色跟着 severity
 * 走，已收档的褪色盖戳让位。article 形态整纸可点入简报，hover
 * 抚平旋转并拿起。
 */
export function NoticeBoard({ items }: { items: Announcement[] }) {
	const feed = byNewest(items);

	return (
		<div className="grid grid-cols-1 gap-5 pt-2 md:grid-cols-6">
			{feed.map((a, i) => {
				const salience = salienceOf(a, statusOf(a));
				return (
					<motion.div
						key={a.id}
						initial={{ opacity: 0, y: 14 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.35, delay: i * 0.05 }}
						className={cn("h-full", SPAN[salience])}
					>
						<Paper
							a={a}
							salience={salience}
							tilt={salience === "major" ? "" : TILTS[i % TILTS.length]}
						/>
					</motion.div>
				);
			})}
		</div>
	);
}

function Paper({ a, salience, tilt }: { a: Announcement; salience: Salience; tilt: string }) {
	const cfg = getAnnouncementSev(a.severity);
	const status = statusOf(a);
	const filed = status === "ended";
	const isArticle = a.display === "article";

	const paper = (
		<div
			className={cn(
				"relative flex h-full flex-col rounded-lg border border-edge-hairline bg-card shadow-sm transition-all duration-300",
				// hover：抚平旋转并拿起（负 y 微抬）
				"hover:z-10 hover:-translate-y-0.5 hover:rotate-0 hover:shadow-md",
				PAD[salience],
				tilt,
				filed && "opacity-60 saturate-50",
				isArticle && "group",
			)}
		>
			<Pins sev={a.severity} double={salience === "major"} />
			{filed ? (
				<span className="absolute top-3 right-3 rotate-6 rounded border border-current px-1.5 py-0.5 font-mono text-[10px] tracking-[0.2em] text-muted-foreground/70">
					已收档
				</span>
			) : null}

			{salience === "minor" ? (
				<div className="flex items-center justify-between gap-3">
					<span className="flex min-w-0 items-center gap-2">
						<span className={cn("size-1.5 shrink-0 rounded-full", cfg.dot)} />
						<span
							className={cn(
								"truncate text-sm font-medium text-foreground",
								isArticle && "group-hover:underline group-hover:underline-offset-4",
							)}
						>
							{a.title}
						</span>
					</span>
					<span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground/70">
						{fmtDate(a.created_at)}
					</span>
				</div>
			) : (
				<>
					<p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] text-muted-foreground/70 uppercase">
						<span className={cn("size-1.5 rounded-full", cfg.dot)} />№
						{String(a.id).padStart(3, "0")} · {BULLETIN_LABEL[a.severity]}
						{isArticle ? (
							<span className="text-muted-foreground/50">· 简报</span>
						) : null}
					</p>
					<h4
						className={cn(
							"mt-2 font-bold tracking-tight text-foreground",
							salience === "major" ? "text-xl md:text-2xl" : "text-base",
							isArticle && "group-hover:underline group-hover:underline-offset-4",
						)}
					>
						{a.title}
					</h4>
					<p
						className={cn(
							"mt-1.5 text-muted-foreground",
							salience === "major"
								? "line-clamp-2 text-sm leading-relaxed"
								: "line-clamp-1 text-xs",
						)}
					>
						{a.excerpt ?? a.content}
					</p>
					<div className="mt-auto flex items-center justify-between gap-3 pt-4 font-mono text-[10px] text-muted-foreground/70">
						<span className="flex flex-wrap gap-1">
							{a.affects?.slice(0, 3).map((m) => (
								<span key={m} className="rounded bg-muted px-1.5 py-0.5">
									{m}
								</span>
							))}
						</span>
						<span className="shrink-0 tabular-nums">
							{fmtStamp(a.created_at)}
							{status === "scheduled" ? (
								<span className="ml-2 text-amber-600 dark:text-amber-400">
									未生效
								</span>
							) : null}
						</span>
					</div>
				</>
			)}
		</div>
	);

	return isArticle ? (
		<Link to="/announcements/$id" params={{ id: String(a.id) }} className="block h-full">
			{paper}
		</Link>
	) : (
		paper
	);
}
