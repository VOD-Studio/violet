import type { Announcement } from "@features/settings/model/types";
import { cn } from "@shared/lib/utils";
import { getAnnouncementSev } from "@shared/ui/announcement-severity";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { fmtStamp, SEV_CODE, statusOf } from "../model/event";

/** 存根联条码：高度错落的细竖线，纯装饰 */
function Barcode() {
	const bars = [12, 6, 10, 4, 8, 12, 5, 9, 6, 11, 4, 8];
	return (
		<span aria-hidden className="flex items-end gap-[2px]">
			{bars.map((h, i) => (
				<span key={i} className="w-[2px] bg-foreground/50" style={{ height: h }} />
			))}
		</span>
	);
}

function Receipt({ a, index }: { a: Announcement; index: number }) {
	const cfg = getAnnouncementSev(a.severity);
	const status = statusOf(a);
	const filed = status === "ended";
	const isArticle = a.display === "article";
	const no = String(a.id).padStart(3, "0");

	const paper = (
		<div
			className={cn(
				"relative flex h-full flex-col border-x border-b border-edge-hairline bg-card px-5 pt-6 pb-4 shadow-sm transition-shadow hover:shadow-md",
				"group",
				filed && "opacity-60 saturate-50",
			)}
		>
			{/* 顶部锯齿毛边：两个 45° 渐变拼出纸齿，色随主题 card */}
			<span
				aria-hidden
				className="absolute inset-x-0 -top-3 h-3"
				style={{
					background:
						"linear-gradient(45deg, var(--card) 8px, transparent 0), linear-gradient(-45deg, var(--card) 8px, transparent 0)",
					backgroundRepeat: "repeat-x",
					backgroundSize: "16px 16px",
				}}
			/>
			<p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] text-muted-foreground/70 uppercase">
				<span className={cn("size-1.5 rounded-full", cfg.dot)} />№{no} ·{" "}
				{SEV_CODE[a.severity]} · {fmtStamp(a.created_at)}
			</p>
			<h4
				className={cn(
					"mt-2 text-base font-semibold text-foreground",
					isArticle && "group-hover:underline group-hover:underline-offset-4",
				)}
			>
				{a.title}
			</h4>
			<p className="mt-1.5 line-clamp-1 text-xs text-muted-foreground">
				{a.excerpt ?? a.content}
			</p>

			{/* 虚线撕裂线 + 存根联：条码 / 编号 / 状态 / 简报入口 */}
			<div className="mt-auto flex items-center justify-between gap-3 border-t border-dashed border-edge-hairline pt-3">
				<span className="flex items-center gap-3">
					<Barcode />
					<span className="font-mono text-[10px] tabular-nums text-muted-foreground/70">
						№{no}
					</span>
				</span>
				<span className="flex items-center gap-2">
					{status === "active" ? (
						<span className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
							<span className={cn("size-1.5 animate-pulse rounded-full", cfg.dot)} />
							进行中
						</span>
					) : (
						<span className="font-mono text-[10px] text-muted-foreground/70">
							{status === "scheduled" ? "未生效" : "已收档"}
						</span>
					)}
					{isArticle ? (
						<ArrowRight className="size-3.5 text-muted-foreground/50 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-foreground" />
					) : null}
				</span>
			</div>
		</div>
	);

	return (
		<motion.div
			initial={{ opacity: 0, y: 14 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.35, delay: index * 0.05 }}
			className="h-full"
		>
			{isArticle ? (
				<Link
					to="/announcements/$id"
					params={{ id: String(a.id) }}
					className="block h-full"
				>
					{paper}
				</Link>
			) : (
				paper
			)}
		</motion.div>
	);
}

/**
 * 方向 E · 票据卷
 *
 * 设计意图：公告是系统开出的票据——等宽打印小票、无大小层级，
 * 顶部锯齿毛边 + 虚线撕裂线 + 存根联（条码 / 编号 / 状态章）。
 * article 的存根联就是简报入口（hover 出箭头）。物件化但克制，
 * 与告示板的「severity 定纸张大小」层级张贴错开。
 */
export function Receipts({ items }: { items: Announcement[] }) {
	return (
		<div className="grid grid-cols-1 gap-5 pt-3 sm:grid-cols-2 xl:grid-cols-3">
			{items.map((a, i) => (
				<Receipt key={a.id} a={a} index={i} />
			))}
		</div>
	);
}
