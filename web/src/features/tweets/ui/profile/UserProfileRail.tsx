import { formatRelativeTime } from "@shared/lib/date";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import type { ProfileActivity } from "../../model/profile-activity";

/** 概览栏中的一个分区；没有内容的分区由调用方不渲染。 */
function RailSection({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="rounded-2xl border border-border p-4">
			<h2 className="text-xs font-medium tracking-wide text-muted-foreground">{title}</h2>
			<div className="mt-3">{children}</div>
		</section>
	);
}

/**
 * 公开用户页右侧的概览栏：只展示能从已有数据算出来的内容。
 *
 * 新的分区在这里追加一个 RailSection 即可；分区没有内容时不渲染，整栏为空时由页面收起这一栏。
 */
export function UserProfileRail({ activity }: { activity: ProfileActivity }) {
	const more = activity.partial ? "+" : "";
	return (
		<div className="flex flex-col gap-4">
			{activity.latestAt && (
				<RailSection title="动态概览">
					<dl className="flex flex-col gap-2.5 text-sm">
						<div className="flex items-baseline justify-between gap-3">
							<dt className="text-muted-foreground">最近发文</dt>
							<dd className="font-medium">{formatRelativeTime(activity.latestAt)}</dd>
						</div>
						<div className="flex items-baseline justify-between gap-3">
							<dt className="text-muted-foreground">近 30 天</dt>
							<dd className="font-medium tabular-nums">
								{activity.recentCount}
								{more} 条
							</dd>
						</div>
						<div className="flex items-baseline justify-between gap-3">
							<dt className="text-muted-foreground">获得点赞</dt>
							<dd className="font-medium tabular-nums">
								{activity.likeCount}
								{more}
							</dd>
						</div>
					</dl>
				</RailSection>
			)}
			{activity.topics.length > 0 && (
				<RailSection title="常用话题">
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
				</RailSection>
			)}
		</div>
	);
}
