/**
 * 后台数据看板页面
 * 展示统计卡片、浏览量趋势图、热门文章排行、最近文章列表
 */

import { Link } from "react-router";
import { useAdminStats, useViewTrends } from "@/features/admin/dashboard/api";
import { ErrorFallback } from "@/components/shared/ErrorFallback";
import { StatsCard, StatsCardSkeleton } from "./StatsCard";
import { ViewTrendsChart } from "./ViewTrendsChart";
import { PopularPostsTable } from "./PopularPostsTable";
import { RecentPostsTable } from "./RecentPostsTable";
import { StatIcon } from "./StatIcon";

/**
 * 数据看板页面
 */
export default function Dashboard() {
  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useAdminStats();
  const { data: viewTrends, isLoading: viewsLoading } = useViewTrends();

  /* 统计数据加载中 */
  if (statsLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">数据看板</h1>
          <p className="text-muted-foreground">加载中...</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <StatsCardSkeleton key={i} />
          ))}
        </div>
        <ViewTrendsChart daily={[]} monthly={[]} isLoading={true} />
      </div>
    );
  }

  /* 统计数据加载失败 */
  if (statsError) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">数据看板</h1>
        <ErrorFallback error={statsError.message} onRetry={refetchStats} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold">数据看板</h1>
        <p className="text-muted-foreground">查看网站运营数据概览</p>
      </div>

      {/* 统计卡片区域 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatsCard
          title="文章总数"
          value={stats?.totalPosts ?? 0}
          icon={<StatIcon type="posts" />}
        />
        <StatsCard
          title="评论总数"
          value={stats?.totalComments ?? 0}
          icon={<StatIcon type="comments" />}
        />
        <StatsCard
          title="待审核评论"
          value={stats?.pendingComments ?? 0}
          icon={<StatIcon type="pending" />}
          className={stats?.pendingComments ? "border-orange-400" : undefined}
          valueClassName="text-orange-600"
          footer={
            stats?.pendingComments ? (
              <Link
                to="/admin/comments"
                className="mt-1 inline-block text-xs text-primary underline-offset-4 hover:underline"
              >
                前往审核
              </Link>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                暂无待审核评论
              </p>
            )
          }
        />
        <StatsCard
          title="总浏览量"
          value={stats?.totalViews ?? 0}
          icon={<StatIcon type="views" />}
        />
        <StatsCard
          title="用户总数"
          value={stats?.totalUsers ?? 0}
          icon={<StatIcon type="users" />}
        />
      </div>

      {/* 浏览量趋势图表 */}
      <ViewTrendsChart
        daily={viewTrends?.daily ?? []}
        monthly={viewTrends?.monthly ?? []}
        isLoading={viewsLoading}
      />

      {/* 热门文章排行 */}
      <PopularPostsTable posts={stats?.popularPosts ?? []} />

      {/* 最近文章列表 */}
      <RecentPostsTable posts={stats?.recentPosts ?? []} />
    </div>
  );
}
