import { fetchSeriesBySlug, seriesKeys, useSeriesDetail } from "@features/series/api";
import type { SeriesDetail } from "@features/series/model/types";
import { SeriesDetailBody } from "@features/series/ui/SeriesDetailBody";
import { ApiError } from "@shared/api/error";
import { SITE_URL } from "@shared/config/env";
import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { Button, Empty, PageShell, Skeleton } from "@violet/ui";

function SeriesPending() {
	return (
		<PageShell>
			<div className="mx-auto max-w-4xl space-y-6">
				<Skeleton className="h-4 w-24 rounded-md" />
				<div className="grid gap-10 md:grid-cols-[220px_minmax(0,1fr)]">
					<Skeleton className="aspect-2/3 w-full rounded-sm" />
					<div className="space-y-4">
						<Skeleton className="h-4 w-32 rounded-md" />
						<Skeleton className="h-12 w-4/5 rounded-lg" />
						<Skeleton className="h-4 w-full rounded-md" />
						<Skeleton className="h-4 w-2/3 rounded-md" />
					</div>
				</div>
				<Skeleton className="h-64 w-full rounded-lg" />
			</div>
		</PageShell>
	);
}

function SeriesMissing() {
	return (
		<PageShell>
			<Empty
				title="系列不存在"
				description="这本书尚未发布或已被移除。"
				action={
					<Button variant="outline" size="sm" asChild>
						<Link to="/blog/series">返回系列</Link>
					</Button>
				}
			/>
		</PageShell>
	);
}

function SeriesError() {
	const router = useRouter();
	return (
		<PageShell>
			<Empty
				title="系列暂时加载失败"
				description="请重试，当前地址会保留。"
				action={<Button onClick={() => void router.invalidate()}>重试</Button>}
			/>
		</PageShell>
	);
}

function SeriesDetailPage() {
	const { slug } = Route.useParams();
	const { data: detail, isPending, error } = useSeriesDetail(slug);
	if (isPending) return <SeriesPending />;
	if (!detail) throw error ?? notFound();
	return (
		<PageShell>
			<SeriesDetailBody detail={detail} />
		</PageShell>
	);
}

export const Route = createFileRoute("/blog/series/$slug")({
	loader: ({ context, params }) =>
		context.queryClient
			.ensureQueryData({
				queryKey: seriesKeys.detail(params.slug),
				queryFn: () => fetchSeriesBySlug(params.slug),
			})
			.catch((error: unknown) => {
				if (error instanceof ApiError && error.status === 404) throw notFound();
				throw error;
			}),
	staticData: { navTitle: (detail: SeriesDetail | undefined) => detail?.title },
	head: ({ params, loaderData }) => ({
		meta: [{ title: loaderData?.title ? `${loaderData.title} · 系列` : "系列" }],
		links: [
			{
				rel: "canonical",
				href: `${SITE_URL.replace(/\/+$/, "")}/blog/series/${encodeURIComponent(params.slug)}`,
			},
		],
	}),
	component: SeriesDetailPage,
	pendingComponent: SeriesPending,
	notFoundComponent: SeriesMissing,
	errorComponent: SeriesError,
});
