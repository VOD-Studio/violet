import { usePublishedGalleryFeed, usePublishedGallerySummary } from "@entities/gallery/api/queries";
import { GalleryAlbumContent } from "@entities/gallery/ui/GalleryAlbumContent";
import { Link } from "@tanstack/react-router";
import { Button, Empty, PageShell, Skeleton } from "@violet/ui";

export const PUBLISHED_GALLERY_PAGE_LIMIT = 12;

function GalleryBrowseSkeleton() {
	return (
		<div role="status" aria-busy="true" aria-label="正在载入相册">
			<Skeleton className="h-80 w-full rounded-2xl md:h-130" />
			<Skeleton className="mt-6 h-8 w-1/2" />
			<Skeleton className="mt-3 h-12 w-2/3" />
			<div className="mt-20 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
				{Array.from({ length: 3 }).map((_, index) => (
					<div key={index} className="space-y-4">
						<Skeleton className="aspect-4/3 w-full rounded-xl" />
						<Skeleton className="h-6 w-1/2" />
					</div>
				))}
			</div>
		</div>
	);
}

/** 精选取第一页首项：首次发布时间倒序，同一时间以 ID 倒序；其余网格排除精选。 */
export function GalleryBrowsePage() {
	const feed = usePublishedGalleryFeed(PUBLISHED_GALLERY_PAGE_LIMIT);
	const summary = usePublishedGallerySummary();
	const [featured, ...remaining] = feed.galleries;

	return (
		<PageShell className="max-w-292">
			<header className="mb-10 flex flex-wrap items-end justify-between gap-4">
				<h1 className="text-4xl font-semibold leading-tight md:text-[52px]">图集</h1>
				{summary.data ? (
					<p className="text-sm text-muted-foreground">
						<span className="font-mono tabular-nums">{summary.data.album_count}</span>{" "}
						个相册 ·{" "}
						<span className="font-mono tabular-nums">{summary.data.image_count}</span>{" "}
						张
					</p>
				) : summary.isError ? (
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<span role="alert">总数暂时无法载入</span>
						<Button variant="ghost" size="sm" onClick={() => void summary.refetch()}>
							重试总数
						</Button>
					</div>
				) : (
					<div role="status" aria-busy="true" aria-label="正在载入相册总数">
						<Skeleton className="h-5 w-40" />
					</div>
				)}
			</header>

			{feed.isLoading ? (
				<GalleryBrowseSkeleton />
			) : feed.isError ? (
				<Empty
					title="加载失败"
					description="暂时无法读取图集，请稍后再试"
					action={
						<Button variant="outline" size="sm" onClick={() => void feed.refetch()}>
							重试
						</Button>
					}
					className="py-20"
				/>
			) : !featured ? (
				<Empty title="暂无图集" description="还没有发布的图集" className="py-20" />
			) : (
				<>
					<Link
						to="/galleries/$slug"
						params={{ slug: featured.slug }}
						aria-label={`查看相册：${featured.title}`}
						className="block rounded-2xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-offset-4 focus-visible:ring-offset-background"
					>
						<GalleryAlbumContent gallery={featured} featured />
					</Link>
					{remaining.length > 0 ? (
						<div className="mt-20 grid gap-x-8 gap-y-14 border-t border-border pt-14 sm:grid-cols-2 lg:grid-cols-3">
							{remaining.map((gallery) => (
								<Link
									key={gallery.id}
									to="/galleries/$slug"
									params={{ slug: gallery.slug }}
									aria-label={`查看相册：${gallery.title}`}
									className="block min-w-0 rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-offset-4 focus-visible:ring-offset-background"
								>
									<GalleryAlbumContent gallery={gallery} />
								</Link>
							))}
						</div>
					) : null}
					{feed.hasMore ? (
						<div className="mt-14 flex justify-center">
							<div className="space-y-3 text-center">
								{feed.loadMoreFailed ? (
									<p role="alert" className="text-destructive text-sm">
										加载下一页失败，请重试
									</p>
								) : null}
								<Button
									variant="outline"
									loading={feed.loadingMore}
									onClick={feed.loadMore}
								>
									{feed.loadMoreFailed ? "重试加载" : "加载更多"}
								</Button>
							</div>
						</div>
					) : null}
				</>
			)}
		</PageShell>
	);
}
