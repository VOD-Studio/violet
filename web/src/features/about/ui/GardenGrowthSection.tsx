import type { UseQueryResult } from "@tanstack/react-query";
import { Skeleton } from "@violet/ui";
import { useMemo } from "react";
import { buildGrowthPeriod, type GardenGrowth, growthDay, growthDayLabel } from "../model/growth";
import { AboutSectionState } from "./AboutSectionState";
import styles from "./GardenGrowth.module.css";
import { GrowthTimeline } from "./GrowthTimeline";

/** 生长图与页首共享同一份查询状态。 */
export interface GardenGrowthSectionProps {
	query: UseQueryResult<GardenGrowth>;
	requestedDate?: string;
}

/** 只有完成首次回填的时间范围才解释空白为零提交。 */
export function GardenGrowthSection({ query, requestedDate }: GardenGrowthSectionProps) {
	const { data, isPending, isError, isFetching, refetch } = query;
	const period = useMemo(
		() => (data ? buildGrowthPeriod(data, requestedDate) : null),
		[data, requestedDate],
	);
	const retry = () => void refetch();

	return (
		<section className={styles.growth} aria-labelledby="garden-growth" aria-busy={isPending}>
			<h2 id="garden-growth" className="sr-only">
				生长图
			</h2>
			{isPending ? (
				<Skeleton className={styles.loadingPlot} />
			) : isError || !data ? (
				<AboutSectionState
					message="暂时无法读取生长记录。"
					isRetrying={isFetching}
					onRetry={retry}
				/>
			) : period ? (
				<>
					{data.health.state === "stale" && (
						<AboutSectionState
							message={staleGrowthMessage(data, "当前显示上次同步的记录。")}
						/>
					)}
					<GrowthTimeline key={period.start} period={period} />
					<GrowthMilestones growth={data} />
				</>
			) : (
				<AboutSectionState
					message={growthStatus(data)}
					isRetrying={isFetching}
					onRetry={retry}
				/>
			)}
		</section>
	);
}

function growthStatus(data: GardenGrowth) {
	if (data.health.state === "stale") {
		return staleGrowthMessage(
			data,
			data.history_complete ? "上次同步没有提交或发布。" : "尚无完整的历史快照。",
		);
	}
	if (data.history_complete) return "公开仓库还没有提交或发布。";
	switch (data.health.state) {
		case "unconfigured":
			return "站点的发布仓库尚未绑定到公开项目。";
		case "failed":
			return "仓库进展同步失败，暂无法确认生长历史。";
		case "limited":
			return "GitHub 请求受限，暂无法确认生长历史。";
		default:
			return "仓库历史仍在回填，完成后会显示首次提交和每周记录。";
	}
}

function staleGrowthMessage(data: GardenGrowth, detail: string) {
	switch (data.health.reason) {
		case "failed":
			return `仓库进展同步失败，${detail}`;
		case "limited":
			return `GitHub 限流，仓库进展暂未更新。${detail}`;
		default:
			return `仓库进展暂未更新，${detail}`;
	}
}

function GrowthMilestones({ growth }: { growth: GardenGrowth }) {
	const first = growth.first_commit;
	const release = growth.releases.at(-1);
	return (
		<ul className={styles.milestones} aria-label="生长里程碑">
			{first && (
				<li>
					<span>{growthDayLabel(growthDay(first.occurred_at))}</span>
					<a href={first.url}>
						首次提交<span className="sr-only">：{first.title}</span>
					</a>
				</li>
			)}
			{release && (
				<li>
					<span>{growthDayLabel(growthDay(release.occurred_at))}</span>
					<a href={release.url}>首次发布 · {release.tag}</a>
				</li>
			)}
			<li>
				<span>{growthDayLabel(growthDay(growth.today))}</span> 今天
			</li>
		</ul>
	);
}
