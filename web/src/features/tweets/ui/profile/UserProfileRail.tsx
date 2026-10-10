import { formatRelativeTime } from "@shared/lib/date";
import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import type { ReactNode } from "react";

import type { ActivityGrid, ProfileActivity } from "../../model/profile-activity";

/** 热力图每档的底色；0 档用静音色，其余是主题色的递增浓度。 */
const LEVELS = [
	"bg-muted",
	"bg-primary/25",
	"bg-primary/50",
	"bg-primary/75",
	"bg-primary",
] as const;

const level = (count: number) => Math.min(count, LEVELS.length - 1);

/** 概览栏中的一个卡片；没有内容的卡片由调用方不渲染。 */
function RailCard({
	title,
	aside,
	children,
}: {
	title: string;
	aside?: ReactNode;
	children: ReactNode;
}) {
	return (
		<section className="rounded-2xl border border-border bg-card p-4 shadow-[0_4px_24px_rgb(0_0_0/0.05)]">
			<div className="flex items-baseline justify-between gap-3">
				<h2 className="text-sm font-semibold">{title}</h2>
				{aside && <span className="text-xs text-muted-foreground">{aside}</span>}
			</div>
			<div className="mt-3">{children}</div>
		</section>
	);
}

/** 近若干周的发文热力图：每列一周，自周一到周日。 */
function Heatmap({ grid, partial }: { grid: ActivityGrid; partial: boolean }) {
	return (
		<RailCard title={`近 ${grid.weeks} 周`} aside={`${grid.total}${partial ? "+" : ""} 条`}>
			<div
				role="img"
				aria-label={`近 ${grid.weeks} 周共发布 ${grid.total} 条推文`}
				className="grid auto-cols-fr grid-flow-col grid-rows-7 gap-1"
			>
				{grid.days.map((day) => (
					<span
						key={day.date}
						title={day.future ? undefined : `${day.date} · ${day.count} 条`}
						className={cn(
							"aspect-square rounded-xs",
							day.future ? "opacity-0" : LEVELS[level(day.count)],
						)}
					/>
				))}
			</div>
			<div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
				<span>{partial ? "仅含已加载的推文" : "每格一天"}</span>
				<span className="flex items-center gap-1" aria-hidden="true">
					少
					{LEVELS.map((color) => (
						<span key={color} className={cn("size-2.5 rounded-xs", color)} />
					))}
					多
				</span>
			</div>
		</RailCard>
	);
}

/**
 * 公开用户页右侧的概览栏：只展示能从已有数据算出来的内容。
 *
 * 新的卡片在这里追加即可；卡片没有内容时不渲染，整栏为空时由页面收起这一栏。
 */
export function UserProfileRail({
	activity,
	grid,
}: {
	activity: ProfileActivity;
	grid: ActivityGrid;
}) {
	const more = activity.partial ? "+" : "";
	return (
		<div className="flex flex-col gap-4">
			{activity.latestAt && (
				<>
					<Heatmap grid={grid} partial={activity.partial} />
					<RailCard title="动态概览">
						<dl className="flex flex-col gap-2.5 text-sm">
							<div className="flex items-baseline justify-between gap-3">
								<dt className="text-muted-foreground">最近发文</dt>
								<dd className="font-medium">
									{formatRelativeTime(activity.latestAt)}
								</dd>
							</div>
							<div className="flex items-baseline justify-between gap-3">
								<dt className="text-muted-foreground">近 30 天</dt>
								<dd className="font-medium tabular-nums">
									{activity.recentCount}
									{more} 条
								</dd>
							</div>
						</dl>
					</RailCard>
				</>
			)}
			{activity.topics.length > 0 && (
				<RailCard title="常用话题">
					<ul className="flex flex-wrap gap-2">
						{activity.topics.map(({ tag, count }) => (
							<li key={tag}>
								<Link
									to="/tweets/topics/$tag"
									params={{ tag }}
									className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
								>
									#{tag}
									<span className="tabular-nums">{count}</span>
								</Link>
							</li>
						))}
					</ul>
				</RailCard>
			)}
		</div>
	);
}
