import { usePublishedGallery } from "@entities/gallery/api/queries";
import { sortedByPosition } from "@entities/gallery/model/sort";
import type { PublishedGalleryItem } from "@entities/gallery/model/types";
import { contentImageUrl } from "@shared/lib/image-url";
import { rememberScrollPosition } from "@shared/lib/navigation-history";
import { Button } from "@shared/ui/base/button";
import Empty from "@shared/ui/empty";
import { ImagePreview } from "@shared/ui/image-preview";
import { PageShell } from "@shared/ui/page-shell";
import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";

interface GalleryDetailPageProps {
	slug: string;
}

const GRID_IMAGE_WIDTH = 2048;
const GRID_SRCSET_WIDTHS = [640, 1024, 1600, 2048];

interface LightboxState {
	open: boolean;
	index: number;
	trigger: HTMLButtonElement | null;
}

const LIGHTBOX_CLOSED: LightboxState = { open: false, index: 0, trigger: null };

function formatPublishedDate(value: string): string {
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("zh-CN");
}

function itemAlt(item: PublishedGalleryItem, index: number, title: string): string {
	return item.alt_text || `${title} · 第 ${index + 1} 张`;
}

function gridSrcSet(url: string): string | undefined {
	if (url.split("?")[0].toLowerCase().endsWith(".gif")) return undefined;
	return GRID_SRCSET_WIDTHS.map((width) => `${contentImageUrl(url, { width })} ${width}w`).join(
		", ",
	);
}

/** 公开图集详情，按服务端 position 顺序展示完整内容，点击进入灯箱。 */
export function GalleryDetailPage({ slug }: GalleryDetailPageProps) {
	const { data: gallery, isLoading, isError } = usePublishedGallery(slug);
	const [lightbox, setLightbox] = useState<LightboxState>(LIGHTBOX_CLOSED);

	if (isLoading) {
		return (
			<PageShell>
				<div className="mx-auto max-w-4xl space-y-8">
					<ShimmerSkeleton className="h-5 w-28 rounded-md" />
					<ShimmerSkeleton className="h-12 w-2/3 rounded-lg" />
					<ShimmerSkeleton className="aspect-4/3 w-full rounded-2xl" />
				</div>
			</PageShell>
		);
	}

	if (isError || !gallery) {
		return (
			<PageShell>
				<Empty
					title="404"
					description="图集不存在或尚未发布"
					action={
						<Button variant="outline" size="sm" asChild>
							<Link to="/galleries">返回图集</Link>
						</Button>
					}
					className="py-20"
					size="lg"
				/>
			</PageShell>
		);
	}

	const date = formatPublishedDate(gallery.published_at);
	const items = sortedByPosition(gallery.items);

	return (
		<PageShell>
			<article className="mx-auto max-w-5xl">
				<Button variant="ghost" size="sm" asChild className="mb-8 -ml-3">
					<Link to="/galleries" onClick={() => rememberScrollPosition("/galleries")}>
						<ArrowLeft className="size-4" />
						返回图集
					</Link>
				</Button>

				<header className="mx-auto mb-12 max-w-3xl text-center">
					<h1 className="font-mono font-bold text-4xl leading-tight md:text-5xl">
						{gallery.title}
					</h1>
					{gallery.summary ? (
						<p className="mt-5 text-muted-foreground text-lg leading-relaxed">
							{gallery.summary}
						</p>
					) : null}
					{date ? (
						<time
							dateTime={gallery.published_at}
							className="mt-4 block text-muted-foreground text-sm"
						>
							{date}
						</time>
					) : null}
				</header>

				<ol className="space-y-12">
					{items.map((item, index) => (
						<li key={item.file_id}>
							<figure className="space-y-3">
								<button
									type="button"
									onClick={(event) =>
										setLightbox({
											open: true,
											index,
											trigger: event.currentTarget,
										})
									}
									className="mx-auto block w-full cursor-zoom-in rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
								>
									<img
										src={contentImageUrl(item.url, { width: GRID_IMAGE_WIDTH })}
										srcSet={gridSrcSet(item.url)}
										sizes="(min-width: 1024px) 1024px, 100vw"
										alt={itemAlt(item, index, gallery.title)}
										width={item.width > 0 ? item.width : undefined}
										height={item.height > 0 ? item.height : undefined}
										loading={index === 0 ? "eager" : "lazy"}
										fetchPriority={index === 0 ? "high" : "auto"}
										className="mx-auto h-auto max-h-[85dvh] max-w-full rounded-xl object-contain"
									/>
								</button>
								{item.caption ? (
									<figcaption className="mx-auto max-w-3xl text-center text-muted-foreground text-sm leading-relaxed">
										{item.caption}
									</figcaption>
								) : null}
							</figure>
						</li>
					))}
				</ol>

				<ImagePreview
					open={lightbox.open}
					onClose={() => setLightbox((state) => ({ ...state, open: false }))}
					images={items.map((item) => item.url)}
					thumbnails={items.map((item) => item.thumbnail || item.url)}
					alts={items.map((item, index) => itemAlt(item, index, gallery.title))}
					currentIndex={lightbox.index}
					onIndexChange={(index) => setLightbox((state) => ({ ...state, index }))}
					triggerElement={lightbox.trigger}
				/>
			</article>
		</PageShell>
	);
}
