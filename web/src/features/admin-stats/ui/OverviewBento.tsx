import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";
import { useDashboardStats, useViewTrends } from "../api/queries";
import { ContentStockTile } from "./ContentStockTile";
import { HeroViewsTile } from "./HeroViewsTile";
import { MilestoneTile } from "./MilestoneTile";
import { PendingCommentsTile } from "./PendingCommentsTile";
import { PopularPostsTile } from "./PopularPostsTile";
import { RecentPostsTile } from "./RecentPostsTile";
import { ViewTrendTile } from "./ViewTrendTile";
import { WeekCommentsTile } from "./WeekCommentsTile";

/**
 * OverviewBento - 后台概览驾驶舱。
 *
 * 12 列非对称 bento：决策支持优先——行动卡与 Hero 数字首屏可见，
 * 每个数字带对比语境（环比/里程碑）。数据获取收敛在此，tile 全部纯展示。
 */
export function OverviewBento() {
	const dashboard = useDashboardStats();
	const trends = useViewTrends(30); // Hero sparkline 与趋势卡 30 档共享缓存

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
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12">
			<div className="sm:col-span-2 lg:col-span-6">
				<HeroViewsTile
					today={data.today_views}
					yesterday={data.yesterday_views}
					daily={trends.data?.daily ?? []}
				/>
			</div>
			<div className="lg:col-span-2">
				<PendingCommentsTile count={data.pending_comments} />
			</div>
			<div className="lg:col-span-2">
				<WeekCommentsTile week={data.week_comments} lastWeek={data.last_week_comments} />
			</div>
			<div className="sm:col-span-2 lg:col-span-2">
				<ContentStockTile posts={data.total_posts} users={data.total_users} />
			</div>

			<div className="sm:col-span-2 lg:col-span-8">
				<ViewTrendTile />
			</div>
			<div className="sm:col-span-2 lg:col-span-4">
				<PopularPostsTile posts={data.popular_posts} />
			</div>

			<div className="sm:col-span-2 lg:col-span-7">
				<RecentPostsTile posts={data.recent_posts} />
			</div>
			<div className="sm:col-span-2 lg:col-span-5">
				<MilestoneTile totalViews={data.total_views} />
			</div>
		</div>
	);
}

/** BentoSkeleton - 概览加载骨架，行高节奏与正式网格对齐 */
function BentoSkeleton() {
	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12" aria-busy>
			<ShimmerSkeleton className="h-44 sm:col-span-2 lg:col-span-6" />
			<ShimmerSkeleton className="h-44 lg:col-span-2" />
			<ShimmerSkeleton className="h-44 lg:col-span-2" />
			<ShimmerSkeleton className="h-44 sm:col-span-2 lg:col-span-2" />
			<ShimmerSkeleton className="h-72 sm:col-span-2 lg:col-span-8" />
			<ShimmerSkeleton className="h-72 sm:col-span-2 lg:col-span-4" />
			<ShimmerSkeleton className="h-48 sm:col-span-2 lg:col-span-7" />
			<ShimmerSkeleton className="h-48 sm:col-span-2 lg:col-span-5" />
		</div>
	);
}
