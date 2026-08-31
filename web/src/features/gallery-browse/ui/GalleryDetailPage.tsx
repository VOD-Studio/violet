import { usePublishedGallery } from "@entities/gallery/api/queries";
import { Button } from "@shared/ui/base/button";
import Empty from "@shared/ui/empty";
import { PageShell } from "@shared/ui/page-shell";
import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

interface GalleryDetailPageProps {
	slug: string;
}

function formatPublishedDate(value: string): string {
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("zh-CN");
}

/** 公开图集详情，按服务端 position 顺序展示完整内容。 */
export function GalleryDetailPage({ slug }: GalleryDetailPageProps) {
	const { data: gallery, isLoading, isError } = usePublishedGallery(slug);

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
	const items = [...gallery.items].sort((left, right) => left.position - right.position);

	return (
		<PageShell>
			<article className="mx-auto max-w-5xl">
				<Button variant="ghost" size="sm" asChild className="mb-8 -ml-3">
					<Link to="/galleries">
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
								<img
									src={item.url}
									alt={item.alt_text || `${gallery.title} · 第 ${index + 1} 张`}
									width={item.width}
									height={item.height}
									loading={index === 0 ? "eager" : "lazy"}
									fetchPriority={index === 0 ? "high" : "auto"}
									className="mx-auto h-auto max-h-[85dvh] max-w-full rounded-xl object-contain"
								/>
								{item.caption ? (
									<figcaption className="mx-auto max-w-3xl text-center text-muted-foreground text-sm leading-relaxed">
										{item.caption}
									</figcaption>
								) : null}
							</figure>
						</li>
					))}
				</ol>
			</article>
		</PageShell>
	);
}
