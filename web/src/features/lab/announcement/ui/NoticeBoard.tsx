import type { Announcement } from "@features/settings/model/types";
import { cn } from "@shared/lib/utils";
import { getAnnouncementSev } from "@shared/ui/announcement-severity";
import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { byNewest, fmtDate, fmtStamp, statusOf } from "../model/event";

/** 显要度：severity 与生命周期共同决定纸张大小 */
type Salience = "major" | "standard" | "minor";

function salienceOf(a: Announcement, status: string): Salience {
	if (status === "active" && (a.severity === "error" || a.severity === "warning")) return "major";
	if (status === "ended" || a.severity === "info") return "minor";
	return "standard";
}

const SPAN = {
	major: "md:col-span-6",
	standard: "md:col-span-3",
	minor: "md:col-span-2",
} as const;

const PAD = {
	major: "p-6",
	standard: "p-5",
	minor: "p-4",
} as const;

/** 非大告示的微旋转错落；大告示保持端正压场 */
const TILTS = ["-rotate-1", "rotate-1", "-rotate-2", "rotate-2"];

/**
 * 方向 C · 告示板
 *
 * 设计意图：布告栏的显要度语法——severity 决定纸张大小：进行中的
 * 故障与维护是整栏大告示，发布动态是半栏中告示，日常信息与已收档
 * 是指甲盖小票据。图钉颜色跟着 severity 走，已收档的褪色盖戳让位。
 * article 形态整纸可点入简报，hover 抚平旋转。
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
				"hover:z-10 hover:rotate-0 hover:shadow-md",
				PAD[salience],
				tilt,
				filed && "opacity-60 saturate-50",
				isArticle && "group",
			)}
		>
			{/* 图钉：severity 色钉头 */}
			<span
				aria-hidden
				className={cn(
					"absolute -top-1.5 left-1/2 size-3 -translate-x-1/2 rounded-full ring-2 ring-background",
					cfg.dot,
				)}
			/>
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
						{String(a.id).padStart(3, "0")} · {cfg.label}
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
						<span className="shrink-0 tabular-nums">{fmtStamp(a.created_at)}</span>
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
