import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";
import { useDashboardStats, useViewTrends } from "../api/queries";
import { ActivityTicker } from "./ActivityTicker";
import { MilestoneTile } from "./MilestoneTile";
import { PopularPostsTile } from "./PopularPostsTile";
import { RecentPostsTile } from "./RecentPostsTile";
import { StatsStrip } from "./StatsStrip";
import { ViewTrendTile } from "./ViewTrendTile";

/**
 * OverviewBento - 后台概览驾驶舱。
 *
 * 终端驾驶舱布局：首屏 mono 仪表带（StatsStrip，全部核心读数与待办），
 * 中部四个终端窗格（趋势/热门/最近/里程碑），底部 tail -f 式活动流
 * 轮播。数据获取收敛在此，区块组件纯展示（ActivityTicker 自取
 * audit 事件流）。
 */
export function OverviewBento() {
	const dashboard = useDashboardStats();
	const trends = useViewTrends(30); // 仪表带 sparkline 与趋势窗格 30 档共享缓存

	if (dashboard.isLoading) {
		return <BentoSkeleton />;
	}

	if (dashboard.isError) {
		return (
			<div className="text-muted-foreground flex h-64 items-center justify-center text-sm">
				统计加载失败，请稍后刷新
			</div>
		);
	}

	const data = dashboard.data;
	if (!data) return <BentoSkeleton />;

	return (
		<div className="flex flex-col gap-4">
			<StatsStrip data={data} daily={trends.data?.daily ?? []} />

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
				<div className="lg:col-span-8">
					<ViewTrendTile />
				</div>
				<div className="lg:col-span-4">
					<PopularPostsTile posts={data.popular_posts ?? []} />
				</div>
				<div className="lg:col-span-7">
					<RecentPostsTile posts={data.recent_posts ?? []} />
				</div>
				<div className="lg:col-span-5">
					<MilestoneTile totalViews={data.total_views} />
				</div>
			</div>

			<ActivityTicker />
		</div>
	);
}

/** BentoSkeleton - 概览加载骨架，区块节奏与正式布局对齐 */
function BentoSkeleton() {
	return (
		<div className="flex flex-col gap-4" aria-busy>
			<ShimmerSkeleton className="h-36 w-full" />
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
				<ShimmerSkeleton className="h-80 lg:col-span-8" />
				<ShimmerSkeleton className="h-80 lg:col-span-4" />
				<ShimmerSkeleton className="h-56 lg:col-span-7" />
				<ShimmerSkeleton className="h-56 lg:col-span-5" />
			</div>
			<ShimmerSkeleton className="h-64 w-full" />
		</div>
	);
}
