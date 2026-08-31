import { publishedGalleryKeys } from "@entities/gallery/api/keys";
import { fetchPublishedGallery } from "@entities/gallery/api/queries";
import { GalleryDetailPage } from "@features/gallery-browse/ui/GalleryDetailPage";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/galleries/$slug")({
	loader: async ({ context, params }) => {
		await context.queryClient
			.ensureQueryData({
				queryKey: publishedGalleryKeys.detail(params.slug),
				queryFn: () => fetchPublishedGallery(params.slug),
			})
			.catch(() => null);
	},
	component: GalleryDetailRoute,
});

function GalleryDetailRoute() {
	const { slug } = Route.useParams();
	return <GalleryDetailPage slug={slug} />;
}
