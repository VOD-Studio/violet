import { publishedGalleryKeys } from "@entities/gallery/api/keys";
import { fetchPublishedGalleries } from "@entities/gallery/api/queries";
import {
	GalleryBrowsePage,
	PUBLISHED_GALLERY_PAGE_LIMIT,
} from "@features/gallery-browse/ui/GalleryBrowsePage";
import { SITE_URL } from "@shared/config/env";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/galleries/")({
	loader: async ({ context }) => {
		const query = { limit: PUBLISHED_GALLERY_PAGE_LIMIT };
		await context.queryClient.ensureQueryData({
			queryKey: publishedGalleryKeys.list(query),
			queryFn: () => fetchPublishedGalleries(query),
		});
	},
	head: () => ({
		meta: [
			{ title: "图集" },
			{ name: "description", content: "按图片顺序浏览已经发布的视觉作品" },
		],
		links: [{ rel: "canonical", href: `${SITE_URL.replace(/\/+$/, "")}/galleries` }],
	}),
	component: GalleryBrowsePage,
});
