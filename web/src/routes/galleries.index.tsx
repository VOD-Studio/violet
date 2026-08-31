import { publishedGalleryKeys } from "@entities/gallery/api/keys";
import { fetchPublishedGalleries } from "@entities/gallery/api/queries";
import {
	GalleryBrowsePage,
	PUBLISHED_GALLERY_PAGE_LIMIT,
} from "@features/gallery-browse/ui/GalleryBrowsePage";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/galleries/")({
	loader: async ({ context }) => {
		const query = { limit: PUBLISHED_GALLERY_PAGE_LIMIT };
		await context.queryClient.ensureQueryData({
			queryKey: publishedGalleryKeys.list(query),
			queryFn: () => fetchPublishedGalleries(query),
		});
	},
	component: GalleryBrowsePage,
});
