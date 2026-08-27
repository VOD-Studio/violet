import { fetchSeriesBySlug, seriesKeys, useSeriesDetail } from "@features/series/api";
import { SeriesDetailBody } from "@features/series/ui/SeriesDetailBody";
import { Button } from "@shared/ui/base/button";
import Empty from "@shared/ui/empty";
import { PageShell } from "@shared/ui/page-shell";
import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";
import { createFileRoute, Link } from "@tanstack/react-router";

function SeriesDetailPage() {
	const { slug } = Route.useParams();
	const { data: detail, isLoading, isError } = useSeriesDetail(slug);

	if (isLoading) {
		return (
			<PageShell>
				<div className="mx-auto max-w-4xl space-y-6">
					<ShimmerSkeleton className="h-4 w-24 rounded-md" />
					<div className="grid gap-10 md:grid-cols-[220px_minmax(0,1fr)]">
						<ShimmerSkeleton className="aspect-2/3 w-full rounded-sm" />
						<div className="space-y-4">
							<ShimmerSkeleton className="h-4 w-32 rounded-md" />
							<ShimmerSkeleton className="h-12 w-4/5 rounded-lg" />
							<ShimmerSkeleton className="h-4 w-full rounded-md" />
							<ShimmerSkeleton className="h-4 w-2/3 rounded-md" />
						</div>
					</div>
					<ShimmerSkeleton className="h-64 w-full rounded-lg" />
				</div>
			</PageShell>
		);
	}
	if (isError || !detail) {
		return (
			<PageShell>
				<Empty
					title="404"
					description="书籍不存在或尚未发布"
					action={
						<Button variant="outline" size="sm" asChild>
							<Link to="/series">返回书架</Link>
						</Button>
					}
					className="py-20"
					size="lg"
				/>
			</PageShell>
		);
	}

	return (
		<PageShell>
			<SeriesDetailBody detail={detail} />
		</PageShell>
	);
}

export const Route = createFileRoute("/series/$slug")({
	loader: async ({ context, params }) => {
		// SSR 预取详情；404（draft 书/不存在）不阻塞导航，组件读缓存判空渲染
		await context.queryClient
			.ensureQueryData({
				queryKey: seriesKeys.detail(params.slug),
				queryFn: () => fetchSeriesBySlug(params.slug),
			})
			.catch(() => null);
		return null;
	},
	head: ({ params }) => ({
		meta: [{ title: `系列书 · ${params.slug}` }],
	}),
	component: SeriesDetailPage,
});
