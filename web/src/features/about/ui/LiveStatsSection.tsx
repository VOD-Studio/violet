import { usePublicStats } from "@features/about/api/queries";
import { useCountUp } from "@shared/hooks/use-count-up";
import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";

import { AboutChapter } from "./AboutChapter";
import { AboutSectionState } from "./AboutSectionState";
import styles from "./AboutSections.module.css";
import type { AboutSectionProps } from "./types";

/** 展示站点公开统计，并在数据到达时平滑更新数字。 */
export function LiveStatsSection(_: AboutSectionProps) {
	const { data, isPending, isError, isFetching, refetch } = usePublicStats();

	if (isPending) {
		return (
			<AboutChapter id="live_stats" title="站点近况" intro="这些数字来自站点的公开统计。">
				<div className={styles.loadingRows} role="status" aria-label="正在加载站点统计">
					{["posts", "words", "comments", "uptime"].map((key) => (
						<div key={key} className={styles.loadingCell}>
							<ShimmerSkeleton className={styles.loadingValue} />
							<ShimmerSkeleton className={styles.loadingLabel} />
						</div>
					))}
				</div>
			</AboutChapter>
		);
	}

	if (isError) {
		return (
			<AboutChapter id="live_stats" title="站点近况" intro="这些数字来自站点的公开统计。">
				<AboutSectionState
					message="站点统计暂时未能抵达。"
					isRetrying={isFetching}
					onRetry={() => void refetch()}
				/>
			</AboutChapter>
		);
	}

	if (!data) {
		return (
			<AboutChapter id="live_stats" title="站点近况" intro="这些数字来自站点的公开统计。">
				<AboutSectionState message="站点统计尚未公开。" />
			</AboutChapter>
		);
	}

	const items = [
		{ label: "文章", value: data.posts_count },
		{ label: "总字数", value: data.total_words },
		{ label: "评论", value: data.comments_count },
		{ label: "运行天数", value: data.uptime_days },
	];

	return (
		<AboutChapter id="live_stats" title="站点近况" intro="这些数字来自站点的公开统计。">
			<div className={styles.statsGrid}>
				{items.map((item) => (
					<div key={item.label} className={styles.stat}>
						<CountUp to={item.value} className={styles.statValue} />
						<span className={styles.statLabel}>{item.label}</span>
					</div>
				))}
			</div>
		</AboutChapter>
	);
}

function CountUp({ to, className }: { to: number; className: string }) {
	const value = useCountUp(to, 900);
	return <span className={className}>{value.toLocaleString("zh-CN")}</span>;
}
