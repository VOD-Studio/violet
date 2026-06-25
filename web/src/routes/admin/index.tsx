import { useDashboardStats, useViewTrends } from "@features/admin-stats/api/queries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@shared/ui/card";
import Loader from "@shared/ui/loader";
import { createFileRoute } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

/**
 * /admin - 后台仪表盘
 */
export const Route = createFileRoute("/admin/")({
	component: DashboardPage,
});

function DashboardPage() {
	const { data: stats, isLoading: statsLoading } = useDashboardStats();
	const { data: trends, isLoading: trendsLoading } = useViewTrends();

	return (
		<div>
			<h2 className="mb-6 font-mono text-xl font-bold tracking-tight">仪表盘</h2>

			{statsLoading ? (
				<div className="flex justify-center py-20">
					<Loader label="加载统计数据" />
				</div>
			) : stats ? (
				<>
					<div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
						<StatCard label="文章" value={stats.total_posts} />
						<StatCard label="评论" value={stats.total_comments} />
						<StatCard label="待审评论" value={stats.pending_comments} />
						<StatCard label="总浏览" value={stats.total_views} />
						<StatCard label="用户" value={stats.total_users} />
					</div>

					<div className="grid gap-4 lg:grid-cols-2">
						<PostListCard title="最近文章" posts={stats.recent_posts} />
						<PostListCard title="热门文章" posts={stats.popular_posts} />
					</div>
				</>
			) : null}

			{trendsLoading ? null : trends ? (
				<Card className="mt-4">
					<CardHeader>
						<CardTitle>浏览趋势</CardTitle>
						<CardDescription>最近 30 日浏览量数据</CardDescription>
					</CardHeader>
					<CardContent>
						{trends.daily.length === 0 ? (
							<p className="text-sm text-muted-foreground">暂无趋势数据</p>
						) : (
							<ul className="max-h-64 space-y-1 overflow-auto text-sm">
								{trends.daily.slice(-14).map((point) => (
									<li key={point.label} className="flex justify-between">
										<span className="text-muted-foreground">{point.label}</span>
										<span>{point.count}</span>
									</li>
								))}
							</ul>
						)}
					</CardContent>
				</Card>
			) : null}
		</div>
	);
}

function StatCard({ label, value }: { label: string; value: number }) {
	return (
		<Card>
			<CardHeader className="pb-2">
				<CardDescription>{label}</CardDescription>
			</CardHeader>
			<CardContent>
				<p className="font-mono text-3xl font-bold">{value}</p>
			</CardContent>
		</Card>
	);
}

function PostListCard({
	title,
	posts,
}: {
	title: string;
	posts: Array<{
		id: string;
		title: string;
		slug: string;
		status: string;
		view_count: number;
		published_at?: string;
	}>;
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
			</CardHeader>
			<CardContent>
				{posts.length === 0 ? (
					<p className="text-sm text-muted-foreground">暂无文章</p>
				) : (
					<ul className="space-y-3 text-sm">
						{posts.map((post) => (
							<li key={post.id} className="flex items-center justify-between">
								<div className="min-w-0 flex-1">
									<p className="truncate font-medium">{post.title}</p>
									<p className="text-xs text-muted-foreground">
										{post.published_at
											? formatDistanceToNow(new Date(post.published_at), {
													addSuffix: true,
													locale: zhCN,
												})
											: "未发布"}
									</p>
								</div>
								<span className="font-mono text-xs text-muted-foreground">
									{post.view_count} 浏览
								</span>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
