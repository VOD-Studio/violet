import { useCountUp } from "@shared/hooks/use-count-up";
import { Link } from "@tanstack/react-router";
import { TrendingDown, TrendingUp } from "lucide-react";
import { computeDelta } from "../lib/metrics";
import type { DashboardStatsDTO, ViewPointDTO } from "../model/types";

interface StripCell {
	/** 中文指标名称（顶部标题） */
	label: string;
	/** 核心读数 */
	value: number;
	/** 底部辅助说明（如环比/状态） */
	context?: string;
	/** 环比趋势方向 */
	trend?: "up" | "down" | "flat";
	/** 待办 >0 时的直达路由与操作文案 */
	action?: { to: string; hint: string };
}

interface StatsStripProps {
	data: DashboardStatsDTO;
	/** 近 30 日数据点（可选） */
	daily?: ViewPointDTO[];
}

/**
 * 概览首屏仪表带。
 *
 * 严整的等宽六格布局，每格统一三段式结构：
 * 顶部指标标题 → 中部核心读数 → 底部上下文/待办直达。
 */
export function StatsStrip({ data }: StatsStripProps) {
	const viewsDelta = computeDelta(data.today_views, data.yesterday_views);
	const weekDelta = computeDelta(data.week_comments, data.last_week_comments);

	const cells: StripCell[] = [
		{
			label: "今日浏览",
			value: data.today_views,
			context:
				viewsDelta === null
					? data.yesterday_views > 0
						? `昨日 ${data.yesterday_views} 次`
						: "昨日 0 次"
					: viewsDelta.direction === "flat"
						? "与昨日持平"
						: `较昨日 ${viewsDelta.direction === "up" ? "+" : "-"}${viewsDelta.percent}%`,
			trend: viewsDelta?.direction,
		},
		{
			label: "待审评论",
			value: data.pending_comments,
			context: data.pending_comments === 0 ? "暂无待审" : undefined,
			action: { to: "/admin/comments", hint: "去审核" },
		},
		{
			label: "友链申请",
			value: data.pending_friend_links,
			context: data.pending_friend_links === 0 ? "暂无待办" : undefined,
			action: { to: "/admin/friend-links", hint: "去处理" },
		},
		{
			label: "订阅异常",
			value: data.failing_subscriptions,
			context: data.failing_subscriptions === 0 ? "运行正常" : undefined,
			action: { to: "/admin/subscriptions", hint: "去排查" },
		},
		{
			label: "本周评论",
			value: data.week_comments,
			context:
				weekDelta === null
					? data.last_week_comments > 0
						? `上周 ${data.last_week_comments} 条`
						: "上周 0 条"
					: weekDelta.direction === "flat"
						? "与上周持平"
						: `较上周 ${weekDelta.direction === "up" ? "+" : "-"}${weekDelta.percent}%`,
			trend: weekDelta?.direction,
		},
		{
			label: "文章总数",
			value: data.total_posts,
			context: `全站 ${data.total_users} 位注册用户`,
		},
	];

	return (
		<section className="border-edge-hairline bg-edge-hairline grid grid-cols-2 gap-px overflow-hidden rounded-sm border sm:grid-cols-3 lg:grid-cols-6">
			{cells.map((cell) => (
				<Cell key={cell.label} cell={cell} />
			))}
		</section>
	);
}

/** 仪表带单格：顶栏标题 + 中部大数字 + 底栏上下文，严格基线对齐 */
function Cell({ cell }: { cell: StripCell }) {
	const alert = cell.action && cell.value > 0;
	const display = useCountUp(cell.value, 900);

	const body = (
		<>
			<div className="flex items-center justify-between">
				<span className="text-muted-foreground text-xs font-medium">{cell.label}</span>
				{alert && (
					<span
						className="size-1.5 rounded-full bg-amber-500 animate-pulse"
						aria-hidden
					/>
				)}
			</div>
			<div className="my-2.5 flex items-baseline">
				<span
					className={`font-mono text-3xl font-bold tracking-tight tabular-nums leading-none ${
						alert ? "text-amber-600 dark:text-amber-400" : "text-foreground"
					}`}
				>
					{display}
				</span>
			</div>
			<div className="flex h-4 items-center text-xs">
				{cell.action && cell.value > 0 ? (
					<span className="text-amber-600 dark:text-amber-400 flex items-center font-medium">
						{cell.action.hint} →
					</span>
				) : cell.context ? (
					<span
						className={`flex items-center gap-1 truncate ${
							cell.trend === "up"
								? "text-emerald-500"
								: cell.trend === "down"
									? "text-red-500"
									: "text-muted-foreground"
						}`}
					>
						{cell.trend === "up" ? (
							<TrendingUp className="size-3 shrink-0" />
						) : cell.trend === "down" ? (
							<TrendingDown className="size-3 shrink-0" />
						) : null}
						<span className="truncate">{cell.context}</span>
					</span>
				) : null}
			</div>
		</>
	);

	const base = "bg-card flex min-h-24 flex-col justify-between p-4";
	if (cell.action && cell.value > 0) {
		return (
			<Link to={cell.action.to} className={`${base} hover:bg-accent/60 transition-colors`}>
				{body}
			</Link>
		);
	}
	return <div className={base}>{body}</div>;
}
