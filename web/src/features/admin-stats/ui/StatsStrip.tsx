import { Link } from "@tanstack/react-router";

import { TrendingDown, TrendingUp } from "lucide-react";
import { computeDelta } from "../lib/metrics";
import type { DashboardStatsDTO, ViewPointDTO } from "../model/types";

interface StripCell {
	/** mono 小签（终端变量风格） */
	tag: string;
	/** 中文标签 */
	label: string;
	value: number;
	/** 上下文行（环比/单位等），无则省略 */
	context?: string;
	/** 上下文行的趋势方向着色 */
	trend?: "up" | "down" | "flat";
	/** 待办 >0 时的直达路由与警示 */
	action?: { to: string; hint: string };
}

interface StatsStripProps {
	data: DashboardStatsDTO;
	/** 近 7 日数据点（今日浏览格的 sparkline） */
	daily: ViewPointDTO[];
}

/**
 * StatsStrip - mono 仪表带。
 *
 * 概览首屏的全宽指标带：大号 tabular-nums 数字 + mono 变量小签 +
 * hairline 分隔，取代六张卡片——仪表读数不需要卡片壳。待办指标
 * >0 时整格 amber 化并成为直达入口，=0 时回归安静读数。
 */
export function StatsStrip({ data, daily }: StatsStripProps) {
	const viewsDelta = computeDelta(data.today_views, data.yesterday_views);
	const weekDelta = computeDelta(data.week_comments, data.last_week_comments);

	const cells: StripCell[] = [
		{
			tag: "views.today",
			label: "今日浏览",
			value: data.today_views,
			context:
				viewsDelta === null
					? data.yesterday_views > 0
						? "昨日无环比"
						: ""
					: viewsDelta.direction === "flat"
						? "与昨日持平"
						: `较昨日 ${viewsDelta.direction === "up" ? "+" : "-"}${viewsDelta.percent}%`,
			trend: viewsDelta?.direction,
		},
		{
			tag: "comments.pending",
			label: "待审评论",
			value: data.pending_comments,
			action: { to: "/admin/comments", hint: "去审核" },
		},
		{
			tag: "friendlinks.pending",
			label: "友链申请",
			value: data.pending_friend_links,
			action: { to: "/admin/friend-links", hint: "去处理" },
		},
		{
			tag: "subscriptions.failing",
			label: "订阅异常",
			value: data.failing_subscriptions,
			action: { to: "/admin/subscriptions", hint: "去排查" },
		},
		{
			tag: "comments.week",
			label: "本周评论",
			value: data.week_comments,
			context:
				weekDelta === null
					? "上周无评论"
					: weekDelta.direction === "flat"
						? "与上周持平"
						: `较上周 ${weekDelta.direction === "up" ? "+" : "-"}${weekDelta.percent}%`,
			trend: weekDelta?.direction,
		},
		{
			tag: "content.stock",
			label: "内容存量",
			value: data.total_posts,
			context: `${data.total_posts} 篇 · ${data.total_users} 位用户`,
		},
	];

	return (
		<section className="border-edge-hairline bg-card flex flex-wrap rounded-sm border">
			{cells.map((cell, i) => (
				<Cell key={cell.tag} cell={cell} sparkline={i === 0 ? daily : undefined} />
			))}
		</section>
	);
}

/** Cell - 仪表带单格。今日浏览格（首格）额外内嵌 sparkline。 */
function Cell({ cell, sparkline }: { cell: StripCell; sparkline?: ViewPointDTO[] }) {
	const alert = cell.action && cell.value > 0;
	const content = (
		<>
			<div className="text-muted-foreground font-mono text-xs">{cell.tag}</div>
			<div
				className={`mt-1 text-4xl leading-none font-bold tabular-nums ${
					alert ? "text-amber-600 dark:text-amber-400" : ""
				}`}
			>
				{cell.value}
			</div>
			<div className="mt-1.5 flex items-center gap-1.5 text-xs">
				<span className="text-foreground/80 font-medium">{cell.label}</span>
				{cell.context && (
					<span
						className={`flex items-center gap-0.5 ${
							cell.trend === "up"
								? "text-emerald-500"
								: cell.trend === "down"
									? "text-red-500"
									: "text-muted-foreground"
						}`}
					>
						{cell.trend === "up" ? (
							<TrendingUp className="size-3" />
						) : cell.trend === "down" ? (
							<TrendingDown className="size-3" />
						) : null}
						{cell.context}
					</span>
				)}
				{alert && (
					<span className="text-amber-600 dark:text-amber-400">
						{cell.action?.hint} →
					</span>
				)}
			</div>
			{sparkline && sparkline.length > 1 && <Sparkline data={sparkline} />}
		</>
	);

	const base = "border-edge-hairline min-w-40 flex-1 border-r border-b px-5 py-4 last:border-r-0";
	if (cell.action && cell.value > 0) {
		return (
			<Link to={cell.action.to} className={`${base} hover:bg-accent/60 transition-colors`}>
				{content}
			</Link>
		);
	}
	return <div className={base}>{content}</div>;
}

/** Sparkline - 无轴微缩趋势线（纯装饰，外层视觉锚点） */
function Sparkline({ data }: { data: ViewPointDTO[] }) {
	const spark = data.slice(-7);
	const max = Math.max(...spark.map((p) => p.count), 1);
	const points = spark
		.map((p, i) => {
			const x = (i / (spark.length - 1)) * 100;
			const y = 30 - (p.count / max) * 26;
			return `${x},${y}`;
		})
		.join(" ");
	return (
		<svg
			viewBox="0 0 100 32"
			className="mt-3 h-8 w-full"
			preserveAspectRatio="none"
			role="presentation"
		>
			<polyline
				points={points}
				fill="none"
				stroke="var(--color-chart-1)"
				strokeWidth={2}
				strokeLinecap="round"
				strokeLinejoin="round"
				vectorEffect="non-scaling-stroke"
			/>
		</svg>
	);
}
