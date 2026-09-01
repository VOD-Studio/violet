import { publishedGalleryKeys } from "@entities/gallery/api/keys";
import { fetchPublishedGallery } from "@entities/gallery/api/queries";
import { sortedByPosition } from "@entities/gallery/model/sort";
import type { PublishedGallery } from "@entities/gallery/model/types";
import { GalleryDetailPage } from "@features/gallery-browse/ui/GalleryDetailPage";
import { ApiError } from "@shared/api/error";
import { SITE_URL } from "@shared/config/env";
import { createFileRoute, notFound } from "@tanstack/react-router";

export const Route = createFileRoute("/galleries/$slug")({
	loader: async ({ context, params }) => {
		try {
			return await context.queryClient.ensureQueryData({
				queryKey: publishedGalleryKeys.detail(params.slug),
				queryFn: () => fetchPublishedGallery(params.slug),
			});
		} catch (error) {
			if (error instanceof ApiError && error.status === 404) throw notFound();
			throw error;
		}
	},
	// 动态 SEO：标题/摘要映射 meta，首图（position 最小项）作 og:image，slug 地址稳定不变
	head: ({ loaderData }) => {
		const gallery = loaderData as PublishedGallery | null;
		if (!gallery) return { meta: [] };
		const siteUrl = SITE_URL.replace(/\/+$/, "");
		const pageUrl = `${siteUrl}/galleries/${gallery.slug}`;
		const firstImage = sortedByPosition(gallery.items)[0];
		return {
			meta: [
				{ title: gallery.title },
				...(gallery.summary
					? [
							{ name: "description", content: gallery.summary },
							{ property: "og:description", content: gallery.summary },
						]
					: []),
				{ property: "og:title", content: gallery.title },
				...(firstImage
					? [{ property: "og:image", content: `${siteUrl}${firstImage.url}` }]
					: []),
				{ property: "og:type", content: "article" },
				{ property: "og:url", content: pageUrl },
			],
			links: [{ rel: "canonical", href: pageUrl }],
		};
	},
	component: GalleryDetailRoute,
});

function GalleryDetailRoute() {
	const { slug } = Route.useParams();
	return <GalleryDetailPage slug={slug} />;
}
