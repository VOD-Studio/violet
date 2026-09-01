import { usePublishedGalleryFeed } from "@entities/gallery/api/queries";
import { sortedByPosition } from "@entities/gallery/model/sort";
import type { PublishedGallery } from "@entities/gallery/model/types";
import { Button } from "@shared/ui/base/button";
import Empty from "@shared/ui/empty";
import { PageShell } from "@shared/ui/page-shell";
import { PhotoStack } from "@shared/ui/photo-stack";
import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";
import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

export const PUBLISHED_GALLERY_PAGE_LIMIT = 12;

function formatPublishedDate(value: string): string {
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("zh-CN");
}

function GalleryCard({ gallery }: { gallery: PublishedGallery }) {
	const date = formatPublishedDate(gallery.published_at);
	const items = sortedByPosition(gallery.items);

	return (
		<PhotoStack
			loading="lazy"
			images={items.map((item, index) => ({
				src: item.thumbnail || item.url,
				alt: item.alt_text || `${gallery.title} · 第 ${index + 1} 张`,
			}))}
			footer={
				<div className="space-y-1.5">
					<Link
						to="/galleries/$slug"
						params={{ slug: gallery.slug }}
						className="inline-flex rounded-sm font-semibold text-lg leading-tight hover:underline focus-visible:outline-2"
					>
						{gallery.title}
					</Link>
					{gallery.summary ? (
						<p className="line-clamp-2 text-muted-foreground text-sm leading-relaxed">
							{gallery.summary}
						</p>
					) : null}
					{date ? (
						<time
							dateTime={gallery.published_at}
							className="block text-muted-foreground text-xs"
						>
							{date}
						</time>
					) : null}
				</div>
			}
		/>
	);
}

function GalleryBrowseSkeleton() {
	return (
		<div className="grid gap-x-10 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
			{Array.from({ length: 6 }).map((_, index) => (
				<div key={index} className="space-y-4">
					<ShimmerSkeleton className="aspect-3/4 w-full rounded-2xl" />
					<ShimmerSkeleton className="h-5 w-2/3 rounded-md" />
					<ShimmerSkeleton className="h-4 w-full rounded-md" />
				</div>
			))}
		</div>
	);
}

/** 已发布图集的游标分页浏览流。 */
export function GalleryBrowsePage() {
	const feed = usePublishedGalleryFeed(PUBLISHED_GALLERY_PAGE_LIMIT);

	if (feed.isLoading) {
		return (
			<PageShell>
				<GalleryBrowseSkeleton />
			</PageShell>
		);
	}

	if (feed.isError) {
		return (
			<PageShell>
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
			</PageShell>
		);
	}

	return (
		<PageShell>
			<header className="mb-12 max-w-2xl space-y-3">
				<p className="font-mono text-muted-foreground text-xs tracking-[0.3em] uppercase">
					Photo Stories
				</p>
				<h1 className="font-mono font-bold text-4xl">图集</h1>
				<p className="text-muted-foreground leading-relaxed">
					按图片顺序浏览已经发布的视觉作品。
				</p>
			</header>

			{feed.galleries.length === 0 ? (
				<Empty
					title="暂无图集"
					description="还没有发布的图集"
					className="py-20"
					size="lg"
				/>
			) : (
				<>
					<div className="grid gap-x-10 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
						{feed.galleries.map((gallery) => (
							<GalleryCard key={gallery.id} gallery={gallery} />
						))}
					</div>
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
									disabled={feed.loadingMore}
									onClick={feed.loadMore}
								>
									{feed.loadingMore ? (
										<Loader2 className="size-4 animate-spin" />
									) : null}
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
