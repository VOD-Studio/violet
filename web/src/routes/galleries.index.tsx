import { useMe } from "@features/auth/api/queries";
import { GALLERY_PAGE_SIZE, useGalleries } from "@features/galleries/api/queries";
import { GalleryFeed } from "@features/galleries/ui/GalleryFeed";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/shared/ui/base/button";
import { PageShell } from "@/shared/ui/page-shell";

/** /galleries - 全站图集浏览流（公开，照片堆叠卡片 + 页码分页） */
export const Route = createFileRoute("/galleries/")({
	component: GalleriesPage,
	validateSearch: (search: Record<string, unknown>) => ({
		page: typeof search.page === "number" && search.page >= 1 ? search.page : 1,
	}),
});

function GalleriesPage() {
	const page = Route.useSearch().page;
	const navigate = Route.useNavigate();
	const { data: me } = useMe();
	const { data, isLoading, isError } = useGalleries({ page, limit: GALLERY_PAGE_SIZE });

	return (
		<PageShell>
			<header className="mb-10 flex flex-wrap items-end justify-between gap-4">
				<div>
					<p className="mb-2 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
						Galleries
					</p>
					<h1 className="font-mono text-4xl font-bold">图集</h1>
				</div>
				{me ? (
					<Button variant="outline" asChild>
						<Link to="/galleries/new">新建图集</Link>
					</Button>
				) : null}
			</header>

			{isError ? (
				<div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
					图集加载失败，请稍后重试
				</div>
			) : (
				<GalleryFeed
					page={page}
					items={data?.data ?? []}
					total={data?.pagination?.total ?? 0}
					isLoading={isLoading}
					onPageChange={(p) => navigate({ search: (prev) => ({ ...prev, page: p }) })}
				/>
			)}
		</PageShell>
	);
}
